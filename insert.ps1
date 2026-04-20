$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyZWRtd2tvZ3RpYnFwdHhqeHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk1NjcsImV4cCI6MjA5MjA0NTU2N30.MUfyZpcCPkOZAYiQdPSdzrWo-wnBI1TUIhtNTvUgbM0"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyZWRtd2tvZ3RpYnFwdHhqeHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk1NjcsImV4cCI6MjA5MjA0NTU2N30.MUfyZpcCPkOZAYiQdPSdzrWo-wnBI1TUIhtNTvUgbM0"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$body = @{
    nombre = "Rocio Leon"
    email = "rocio.leon.asesorst@gmail.com"
    telefono = "+573128621105"
    estado = "Nuevo"
    proyecto_nombre = "Seguimiento Clientes"
    como_se_entero = "Landing page"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://jredmwkogtibqptxjxtx.supabase.co/rest/v1/crm_prospectos" -Method Post -Headers $headers -Body $body
