# Coach Tracker Pro - Debug ReferenceError + Stop reload loop

$DEPLOY = "C:\Users\SPECTRE\Desktop\CPT-deploy\ctp-deploy"
cd $DEPLOY

# 1. Affiche le contenu de sw.js pour voir la logique de reload
Write-Host "=== sw.js ===" -ForegroundColor Cyan
Get-Content ".\sw.js"

# 2. Cherche tout appel a location.reload ou clients dans sw.js
Write-Host "`n=== Recherche reload/clients dans sw.js ===" -ForegroundColor Cyan
Select-String -Path ".\sw.js" -Pattern "reload|clients|skipWaiting|claim"

# 3. Cherche le ReferenceError : variable non definie dans les JS
Write-Host "`n=== Variables potentiellement non definies dans js/ ===" -ForegroundColor Cyan
Get-ChildItem -Path ".\js" -Recurse -Filter "*.js" | Select-String -Pattern "vConsole|VConsole|debugTool|__debug"

# 4. Patch index.html : banniere rouge d'erreur visible + stop reload
Write-Host "`n=== Patch index.html avec error banner ===" -ForegroundColor Cyan
$idx = Get-Content ".\index.html" -Raw

$banner = @'
<script>
(function(){
  var _rl = location.reload.bind(location);
  var _count = 0;
  location.reload = function(){
    _count++;
    if(_count > 2){ console.warn("reload bloque"); return; }
    _rl();
  };
  window.onerror = function(msg,src,line,col,err){
    var d = document.getElementById('_errbanner');
    if(!d){ d=document.createElement('div'); d.id='_errbanner';
      d.style='position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:8px 12px;z-index:99999;font:13px monospace;word-break:break-all';
      document.body?document.body.prepend(d):document.addEventListener('DOMContentLoaded',function(){document.body.prepend(d)});
    }
    d.textContent='ERR: '+msg+' | '+String(src).split('/').pop()+':'+line;
    return false;
  };
  window.addEventListener('unhandledrejection',function(e){
    window.onerror('Promise rejection: '+(e.reason&&e.reason.message||e.reason),'promise',0);
  });
})();
</script>
'@

if ($idx -match "_errbanner") {
    Write-Host "Banner deja present" -ForegroundColor Yellow
} elseif ($idx -match "<head>") {
    $idx = $idx -replace "<head>", "<head>`n$banner"
    Set-Content ".\index.html" $idx -Encoding UTF8
    Write-Host "Banner injecte dans <head>" -ForegroundColor Green
}

# 5. Git push
Write-Host "`n=== Git push ===" -ForegroundColor Cyan
git add -A
git commit -m "debug: error banner + reload throttle"
git push

Write-Host "`nDONE - Apres deploiement, recharge la PWA." -ForegroundColor Green
Write-Host "Un bandeau ROUGE apparaitra avec le nom exact du fichier et la ligne." -ForegroundColor Green
