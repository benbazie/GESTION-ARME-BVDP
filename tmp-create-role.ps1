$loginBody = @{ username='admin'; password='admin123' } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $resp.token
$headers = @{ Authorization = "Bearer $token" }
$roleBody = @{ nom = 'test_role_cli'; permissions = @('module_systeme') } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3001/api/roles' -Method Post -Headers $headers -Body $roleBody -ContentType 'application/json' | ConvertTo-Json -Depth 5
