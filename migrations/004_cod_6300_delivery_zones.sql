create temp table _cod_delivery_zone_seed (
  region text not null,
  city text not null,
  aliases text[] not null,
  delivery_fee numeric not null
) on commit drop;

insert into _cod_delivery_zone_seed (region, city, aliases, delivery_fee)
values
  ('Ayeyarwady Region', 'မြောင်းမြ', array['မြောင်းမြ'], 6300),
  ('Ayeyarwady Region', 'ပုသိမ်', array['ပုသိမ်'], 6300),
  ('Ayeyarwady Region', 'ဟင်္သာတ', array['ဟင်္သာတ'], 6300),
  ('Ayeyarwady Region', 'ဇလွန်', array['ဇလွန်'], 6300),
  ('Ayeyarwady Region', 'ဓနုဖြူ', array['ဓနုဖြူ'], 6300),
  ('Ayeyarwady Region', 'မအူပင်', array['မအူပင်'], 6300),
  ('Ayeyarwady Region', 'ကျိုက်လတ်', array['ကျိုက်လတ်'], 6300),
  ('Ayeyarwady Region', 'ဝါးခယ်မ', array['ဝါးခယ်မ'], 6300),
  ('Ayeyarwady Region', 'မော်လမြိုင်ကျွန်း', array['မော်လမြိုင်ကျွန်း'], 6300),
  ('Ayeyarwady Region', 'ဘိုကလေး', array['ဘိုကလေး'], 6300),
  ('Ayeyarwady Region', 'ကျုံမငေး', array['ကျုံမငေး'], 6300),
  ('Ayeyarwady Region', 'ကန်ကြီးထောင့်', array['ကန်ကြီးထောင့်', 'ကန်ကြီးထောင့်'], 6300),
  ('Ayeyarwady Region', 'ဒါးက', array['ဒါးက'], 6300),
  ('Ayeyarwady Region', 'လပ္ပတ္တာ', array['လပ္ပတ္တာ'], 6300),
  ('Ayeyarwady Region', 'ဖျာပုံ', array['ဖျာပုံ'], 6300),
  ('Ayeyarwady Region', 'ပန်းတနော်', array['ပန်းတနော်'], 6300),
  ('Ayeyarwady Region', 'အင်းမ', array['အင်းမ'], 6300),
  ('Ayeyarwady Region', 'ဒေးဒရဲ', array['ဒေးဒရဲ'], 6300),
  ('Ayeyarwady Region', 'ကြံခင်း', array['ကြံခင်း'], 6300),
  ('Ayeyarwady Region', 'မြန်အောင်', array['မြန်အောင်'], 6300),
  ('Ayeyarwady Region', 'ထူးကြီး', array['ထူးကြီး'], 6300),
  ('Ayeyarwady Region', 'လေးမျက်နှာ', array['လေးမျက်နှာ'], 6300),
  ('Ayeyarwady Region', 'ညောင်တုန်း', array['ညောင်တုန်း'], 6300),
  ('Ayeyarwady Region', 'အိမ်မဲ', array['အိမ်မဲ'], 6300),
  ('Ayeyarwady Region', 'ငပုတော', array['ငပုတော'], 6300),
  ('Ayeyarwady Region', 'ကျောင်းကုန်း', array['ကျောင်းကုန်း'], 6300),
  ('Ayeyarwady Region', 'ကျုံပျော်', array['ကျုံပျော်'], 6300),
  ('Ayeyarwady Region', 'ရေကြည်', array['ရေကြည်'], 6300),
  ('Ayeyarwady Region', 'အင်္ဂပူ', array['အင်္ဂပူ'], 6300),

  ('Mon State', 'မော်လမြိုင်', array['မော်လမြိုင်'], 6300),
  ('Mon State', 'မုဒုံ', array['မုဒုံ'], 6300),
  ('Mon State', 'သထုံ', array['သထုံ'], 6300),
  ('Mon State', 'ကျိုက်မရော', array['ကျိုက်မရော'], 6300),
  ('Mon State', 'သံဖြူဇရပ်', array['သံဖြူဇရပ်'], 6300),
  ('Mon State', 'ကျိုက်ထို', array['ကျိုက်ထို'], 6300),
  ('Mon State', 'ရေး', array['ရေး'], 6300),
  ('Mon State', 'ဘီးလင်း', array['ဘီးလင်း'], 6300),
  ('Mon State', 'ကျိုက္ခမီ', array['ကျိုက္ခမီ'], 6300),
  ('Mon State', 'ဇင်းကျိုက်', array['ဇင်းကျိုက်'], 6300),
  ('Mon State', 'မုတ္တမ', array['မုတ္တမ'], 6300),

  ('Bago Region', 'ပဲခူး', array['ပဲခူး'], 6300),
  ('Bago Region', 'အင်းတကော်', array['အင်းတကော်'], 6300),
  ('Bago Region', 'ဘုရားကြီး', array['ဘုရားကြီး'], 6300),
  ('Bago Region', 'ပြည်', array['ပြည်'], 6300),
  ('Bago Region', 'ကြို့ပင်ကောက်', array['ကြို့ပင်ကောက်'], 6300),
  ('Bago Region', 'နတ်တလင်း', array['နတ်တလင်း'], 6300),
  ('Bago Region', 'ပေါင်းတည်', array['ပေါင်းတည်'], 6300),
  ('Bago Region', 'ဒိုက်ဦး', array['ဒိုက်ဦး'], 6300),
  ('Bago Region', 'ပြွန်တန်ဆာ', array['ပြွန်တန်ဆာ'], 6300),
  ('Bago Region', 'ညောင်လေးပင်', array['ညောင်လေးပင်'], 6300),
  ('Bago Region', 'တောင်ငူ', array['တောင်ငူ'], 6300),
  ('Bago Region', 'အုတ်တွင်း', array['အုတ်တွင်း'], 6300),
  ('Bago Region', 'ကေတုမတီ', array['ကေတုမတီ'], 6300),
  ('Bago Region', 'ကျောက်တံခါး', array['ကျောက်တံခါး'], 6300),
  ('Bago Region', 'ဖြူး', array['ဖြူး'], 6300),
  ('Bago Region', 'သာယာဝတီ', array['သာယာဝတီ'], 6300),
  ('Bago Region', 'ပေါင်းတလည်', array['ပေါင်းတလည်'], 6300),
  ('Bago Region', 'ပဲနွယ်ကုန်း', array['ပဲနွယ်ကုန်း'], 6300),
  ('Bago Region', 'သုံးဆယ်', array['သုံးဆယ်'], 6300),
  ('Bago Region', 'အုတ်ဖို', array['အုတ်ဖို'], 6300),
  ('Bago Region', 'ရေတာရှည်', array['ရေတာရှည်'], 6300),
  ('Bago Region', 'လက်ပံတန်း', array['လက်ပံတန်း'], 6300),
  ('Bago Region', 'သနပ်ပင်', array['သနပ်ပင်'], 6300),
  ('Bago Region', 'ရွှေကျင်', array['ရွှေကျင်'], 6300),

  ('Magway Region', 'မကွေး', array['မကွေး'], 6300),
  ('Magway Region', 'ပခုက္ကူ', array['ပခုက္ကူ'], 6300),
  ('Magway Region', 'မင်းဘူး', array['မင်းဘူး'], 6300),
  ('Magway Region', 'ချောက်', array['ချောက်'], 6300),
  ('Magway Region', 'အောင်လံ', array['အောင်လံ'], 6300),
  ('Magway Region', 'နတ်မောက်', array['နတ်မောက်'], 6300),
  ('Magway Region', 'တောင်တွင်းကြီး', array['တောင်တွင်းကြီး'], 6300),
  ('Magway Region', 'ရေနံချောင်း', array['ရေနံချောင်း'], 6300),
  ('Magway Region', 'ပွင့်ဖြူ', array['ပွင့်ဖြူ', 'ပွင့်ဖြူ'], 6300),
  ('Magway Region', 'စလင်း', array['စလင်း'], 6300),
  ('Magway Region', 'ဆိပ်ဖြူ', array['ဆိပ်ဖြူ'], 6300),
  ('Magway Region', 'မင်းတုန်း', array['မင်းတုန်း'], 6300),
  ('Magway Region', 'ကံမ', array['ကံမ'], 6300),
  ('Magway Region', 'စကု', array['စကု'], 6300),
  ('Magway Region', 'ရေစကြို', array['ရေစကြို'], 6300),

  ('Sagaing Region', 'စစ်ကိုင်း', array['စစ်ကိုင်း'], 6300),
  ('Sagaing Region', 'မုံရွာ', array['မုံရွာ'], 6300),
  ('Sagaing Region', 'ရွှေဘို', array['ရွှေဘို'], 6300),
  ('Sagaing Region', 'မြင်းမူ', array['မြင်းမူ'], 6300),

  ('Shan State', 'တောင်ကြီး', array['တောင်ကြီး'], 6300),
  ('Shan State', 'အေးသာယာ', array['အေးသာယာ'], 6300),
  ('Shan State', 'အောင်ပန်း', array['အောင်ပန်း'], 6300),
  ('Shan State', 'ပင်းတယ', array['ပင်းတယ'], 6300),
  ('Shan State', 'ကလော', array['ကလော'], 6300),
  ('Shan State', 'ညောင်ရွှေ', array['ညောင်ရွှေ'], 6300),
  ('Shan State', 'ရွှေညောင်', array['ရွှေညောင်'], 6300),
  ('Shan State', 'ရပ်စောက်', array['ရပ်စောက်'], 6300),
  ('Shan State', 'နမ့်စန်', array['နမ့်စန်', 'နမ့်စန်'], 6300),
  ('Shan State', 'တာချီလိတ်', array['တာချီလိတ်', 'tachileik'], 10000),

  ('Kayin State', 'ဘားအံ', array['ဘားအံ'], 6300),

  ('Mandalay Region far towns', 'ပလိပ်', array['ပလိပ်'], 6300),
  ('Mandalay Region far towns', 'မြစ်ငယ်', array['မြစ်ငယ်'], 6300),
  ('Mandalay Region far towns', 'ကျောက်ဆည်', array['ကျောက်ဆည်'], 6300),
  ('Mandalay Region far towns', 'မြစ်သား', array['မြစ်သား'], 6300),
  ('Mandalay Region far towns', 'ကူမဲ', array['ကူမဲ'], 6300),
  ('Mandalay Region far towns', 'စဉ့်ကိုင်', array['စဉ့်ကိုင်', 'စဉ့်ကိုင်'], 6300),
  ('Mandalay Region far towns', 'အုန်းချော', array['အုန်းချော'], 6300),
  ('Mandalay Region far towns', 'သာစည်', array['သာစည်'], 6300),
  ('Mandalay Region far towns', 'ပျော်ဘွယ်', array['ပျော်ဘွယ်'], 6300),
  ('Mandalay Region far towns', 'မြင်းခြံ', array['မြင်းခြံ'], 6300),
  ('Mandalay Region far towns', 'ရမည်းသင်း', array['ရမည်းသင်း'], 6300),
  ('Mandalay Region far towns', 'မိတ္ထီလာ', array['မိတ္ထီလာ'], 6300),
  ('Mandalay Region far towns', 'ကျောက်ပန်းတောင်း', array['ကျောက်ပန်းတောင်း'], 6300),
  ('Mandalay Region far towns', 'ညောင်ဦး', array['ညောင်ဦး'], 6300),
  ('Mandalay Region far towns', 'ပုဂံ', array['ပုဂံ'], 6300),
  ('Mandalay Region far towns', 'မတ္တရာ', array['မတ္တရာ'], 6300),
  ('Mandalay Region far towns', 'မလှိင်', array['မလှိင်', 'မလှိုင်'], 6300),
  ('Mandalay Region far towns', 'ဝမ်းတွင်း', array['ဝမ်းတွင်း'], 6300);

update public.delivery_zones dz
set
  aliases = array(
    select distinct u.alias
    from unnest(coalesce(dz.aliases, '{}'::text[]) || seed.aliases) as u(alias)
  ),
  cod_available = true,
  delivery_fee = seed.delivery_fee,
  payment_method = 'အိမ်ရောက်ငွေချေ',
  note = seed.region
from _cod_delivery_zone_seed seed
where dz.city = seed.city
   or coalesce(dz.aliases, '{}'::text[]) && seed.aliases;

insert into public.delivery_zones (
  city,
  township,
  aliases,
  cod_available,
  delivery_fee,
  payment_method,
  estimated_days,
  note
)
select
  seed.city,
  null,
  seed.aliases,
  true,
  seed.delivery_fee,
  'အိမ်ရောက်ငွေချေ',
  null,
  seed.region
from _cod_delivery_zone_seed seed
where not exists (
  select 1
  from public.delivery_zones dz
  where dz.city = seed.city
     or coalesce(dz.aliases, '{}'::text[]) && seed.aliases
);
