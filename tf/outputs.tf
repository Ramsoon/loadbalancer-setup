output "proxy_public_ip" {
  description = "Public IP of the proxy server"
  value       = aws_instance.proxy_server.public_ip
}

output "backend_private_ip" {
  description = "Private IP of the backend server (use this in nginx proxy_pass)"
  value       = aws_instance.backend_server[*].private_ip
}

# output "ssh_to_proxy" {
#   description = "SSH into the proxy, forwarding your key agent"
#   value       = "ssh -A -i febcourse.pem ubuntu@${aws_instance.proxy_server.public_ip}"
# }

# output "ssh_to_backend_via_proxy" {
#   description = "SSH into the backend by jumping through the proxy"
#   value       = "ssh -i febcourse.pem -J ubuntu@${aws_instance.proxy_server.public_ip} ubuntu@${aws_instance.backend_server.private_ip}"
# }
