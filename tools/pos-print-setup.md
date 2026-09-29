# POS adisyon yazıcısı kurulumu

Cep telefonundaki **Adisyon Yazdır** ve **Tekrar Yazdır** düğmeleri, adisyonu sunucudaki kuyruğa ekler. Windows ana bilgisayarındaki küçük uygulama kuyruğu okuyup USB yazıcıya gönderir. Bilgisayar açık, Windows oturumu açık ve yazıcı bağlı olmalıdır. Bu çıktı mali fiş değildir.

## 1. Veritabanı

Supabase SQL Editor'de depo kökündeki `pos-print-queue.sql` dosyasını bir kez çalıştırın.

## 2. Sunucu

Kod GitHub üzerinden sunucuya geldikten sonra `/var/www/lemans-deli` dizininde:

```bash
cd /var/www/lemans-deli
test -f .env.local || exit 1
if grep -q '^POS_PRINT_WORKER_TOKEN=' .env.local; then
  echo 'Anahtar zaten tanımlı; ikinci bir satır eklemeyin.'
else
  token=$(openssl rand -hex 32)
  printf '\nPOS_PRINT_WORKER_TOKEN=%s\n' "$token" >> .env.local
  chmod 600 .env.local
  printf 'Windows kurulumunda girilecek anahtar: %s\n' "$token"
fi
npm run build
pm2 restart lemans-deli --update-env
```

Anahtarı yalnızca Windows ana bilgisayarında kuruluma girin. Daha önce tanımlıysa `.env.local` içindeki mevcut değeri güvenli bir yolla Windows'a aktarın; sohbet mesajına yapıştırmayın. Sunucuya erişen kullanıcı `POS_PRINT_WORKER_TOKEN` ve Supabase service role anahtarını gizli tutmalıdır.

## 3. Windows ana bilgisayarı

USB yazıcının Windows'ta kurulu olduğundan ve Windows'tan deneme sayfası bastığından emin olun. Depoyu ana bilgisayara indirdiyseniz PowerShell'de depo klasöründen şunu çalıştırın:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-pos-print-agent.ps1 -Setup
```

Yazıcı adını listede göründüğü gibi seçin, sonra sunucudaki anahtarı girin. Uygulama kullanıcı profiline kurulur ve Windows oturumu açıldığında kendiliğinden başlar. Yazıcı adını veya anahtarı değiştirmek için aynı `-Setup` komutunu yeniden çalıştırın; önce çalışan `print-agent.ps1` işlemini kapatın.

Uygulama 58 mm kağıt için hazırlanmıştır. Yazıcı 80 mm ise `windows-pos-print-agent.ps1` içindeki kağıt genişliğini ve satır genişliğini uyarlamak gerekir.

## Kontrol

Telefondan POS'ta bir adisyon açıp **Adisyon Yazdır** düğmesine basın. Kuyruğa eklendi uyarısı görülür; ana bilgisayarda birkaç saniye içinde çıktı alınır. Windows günlük dosyası `%LOCALAPPDATA%\LemansDeliPrint\agent.log` konumundadır. Supabase SQL Editor'de son işleri ve durumlarını görmek için:

```sql
select created_at, receipt_number, status, attempts, last_error
from public.pos_print_jobs
order by created_at desc limit 20;
```

`done` durumu Windows yazdırma sisteminin işi kabul ettiğini belirtir. Kağıt çıktısını da gözle kontrol edin. `failed` durumunda yazıcı bağlantısını ve günlük dosyasını kontrol edip POS'taki yazdırma düğmesiyle yeniden kuyruklayın.
