do $$
begin
  if not exists (
    select 1
    from public.delivery_zones
    where city = 'တာချီလိတ်'
       or 'တာချီလိတ်' = any(aliases)
       or 'tachileik' = any(aliases)
  ) then
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
    values (
      'တာချီလိတ်',
      null,
      array['တာချီလိတ်', 'tachileik'],
      true,
      10000,
      'အိမ်ရောက်ငွေချေ',
      null,
      'တာချီလိတ် special COD'
    );
  else
    update public.delivery_zones
    set
      aliases = array(select distinct unnest(coalesce(aliases, '{}') || array['တာချီလိတ်', 'tachileik'])),
      cod_available = true,
      delivery_fee = 10000,
      payment_method = 'အိမ်ရောက်ငွေချေ',
      note = coalesce(note, 'တာချီလိတ် special COD')
    where city = 'တာချီလိတ်'
       or 'တာချီလိတ်' = any(aliases)
       or 'tachileik' = any(aliases);
  end if;
end $$;
