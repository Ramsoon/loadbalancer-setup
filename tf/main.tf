terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ---------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------
data "aws_availability_zones" "available" {
  state = "available"
}

# Latest Ubuntu 26.04 LTS AMI, published by Canonical (x86_64)
data "aws_ssm_parameter" "ubuntu" {
  name = "/aws/service/canonical/ubuntu/server/26.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

locals {
  az = data.aws_availability_zones.available.names[0]
}

# ---------------------------------------------------------------
# Network
# ---------------------------------------------------------------
resource "aws_vpc" "proxy_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "proxy-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.proxy_vpc.id

  tags = { Name = "proxy-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.proxy_vpc.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = local.az
  map_public_ip_on_launch = true

  tags = { Name = "proxy-public-subnet" }
}

resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.proxy_vpc.id
  cidr_block              = var.private_subnet_cidr
  availability_zone       = local.az
  map_public_ip_on_launch = false

  tags = { Name = "proxy-private-subnet" }
}

# Public route table: default route to the internet gateway
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.proxy_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = { Name = "proxy-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Private route table: local traffic only, unless the NAT gateway is enabled
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.proxy_vpc.id

  tags = { Name = "proxy-private-rt" }
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}

# Optional NAT gateway so the backend can download packages (outbound only)
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"

  tags = { Name = "proxy-nat-eip" }
}

resource "aws_nat_gateway" "nat" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public.id

  tags       = { Name = "proxy-nat" }
  depends_on = [aws_internet_gateway.igw]
}

resource "aws_route" "private_nat" {
  count                  = var.enable_nat_gateway ? 1 : 0
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat[0].id
}

# ---------------------------------------------------------------
# Security groups
# ---------------------------------------------------------------
resource "aws_security_group" "proxy_sg" {
  name        = "proxy-sg"
  description = "Public proxy server: SSH and HTTP"
  vpc_id      = aws_vpc.proxy_vpc.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "proxy-sg" }
}

resource "aws_security_group" "backend_sg" {
  name        = "backend-sg"
  description = "Private backend: reachable only from proxy-sg"
  vpc_id      = aws_vpc.proxy_vpc.id

  ingress {
    description     = "SSH from proxy server only"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.proxy_sg.id]
  }

  ingress {
    description     = "Application port from proxy server only"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.proxy_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "backend-sg" }
}

# ---------------------------------------------------------------
# EC2 instances
# ---------------------------------------------------------------
resource "aws_instance" "proxy_server" {
  ami                         = data.aws_ssm_parameter.ubuntu.value
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.proxy_sg.id]
  associate_public_ip_address = true

  tags = { Name = "proxy-server" }
}

resource "aws_instance" "backend_server" {
  ami                         = data.aws_ssm_parameter.ubuntu.value
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = aws_subnet.private.id
  vpc_security_group_ids      = [aws_security_group.backend_sg.id]
  associate_public_ip_address = false
  count                       = var.backend_count

  tags = { Name = "backend-server${count.index + 1}" }
}
