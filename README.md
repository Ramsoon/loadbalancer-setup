# Reverse proxy demo: DevOpsHub

## 1. Provision the infrastructure with Terraform

Before deploying, install Terraform and configure AWS credentials using your
usual AWS CLI profile or environment variables. The AWS identity needs
permissions to create the resources defined in `tf/`.

Set the inputs in `tf/terraform.tfvars` (this local file is ignored by Git):

```hcl
region           = "us-east-1"
key_name         = "febcourse"
ssh_allowed_cidr = "YOUR_PUBLIC_IP/32"
```

Use the name of an existing EC2 key pair in the selected region for `key_name`.
Replace `YOUR_PUBLIC_IP/32` with your public IP in CIDR notation; the default
allows SSH from anywhere, so set this explicitly to restrict access. Other
inputs, including the instance type, application port, network CIDRs, and
optional NAT gateway, are documented with their defaults in `tf/variables.tf`.
Do not commit `terraform.tfvars`, private keys, or Terraform state.

Initialize, review, and apply the configuration:

```bash
cd tf
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

Review the plan before confirming `terraform apply`. The optional NAT gateway
is disabled by default; enabling it incurs ongoing AWS charges.

After deployment, Terraform prints the proxy/backend IP addresses and SSH
commands. You can display them again with:

```bash
terraform output
```

When you no longer need the demo infrastructure, remove it to stop ongoing
charges:

```bash
terraform destroy
```

## 2. Backend (private server, no public IP)

```bash
node server.js            # listens on 0.0.0.0:3000
# PORT=8080 HOST=10.0.1.20 node server.js   (optional)
```

No `npm install` needed. Node 16+.

## 3. Proxy (public IP), nginx

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://BACKEND_PRIVATE_IP:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

The proxy must be able to reach the backend's private IP (same VPC/subnet, VPN, or SSH tunnel).

## 4. Demo script

1. Open `http://BACKEND_PRIVATE_IP:3000` from your laptop. It fails or times out, which shows the backend is unreachable.
2. Open `http://PROXY_PUBLIC_IP`. The platform loads.
3. Select **Trace this request**. The page shows the proxy as the connecting address and your IP in X-Forwarded-For.
4. Optional: stop nginx and refresh to show the site go down, then bring it back.
5. Optional: remove the `X-Forwarded-For` line, reload nginx, trace again, and the page shows the headers are missing.

## Endpoints

- `/` UI
- `/api/courses` course data
- `/api/whoami` what the backend sees (connection address, forwarded headers)
