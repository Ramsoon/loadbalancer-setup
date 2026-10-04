variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair in this region (used for SSH)"
  type        = string
  default     = "febcourse"
}

variable "instance_type" {
  description = "EC2 instance type for both servers"
  type        = string
  default     = "t3.micro"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  type    = string
  default = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  type    = string
  default = "10.0.2.0/24"
}

variable "app_port" {
  description = "Port the Node application listens on"
  type        = number
  default     = 3000
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH into the proxy server. Restrict this to your own IP (x.x.x.x/32) if you can."
  type        = string
  default     = "0.0.0.0/0"
}

variable "enable_nat_gateway" {
  description = "Give the private subnet outbound internet (for installing Node.js). Costs about $32/month while it exists."
  type        = bool
  default     = false
}
