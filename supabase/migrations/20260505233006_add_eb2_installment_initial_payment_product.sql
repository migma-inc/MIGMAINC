insert into public.visa_products (
  slug,
  name,
  description,
  base_price_usd,
  price_per_dependent_usd,
  is_active,
  allow_extra_units,
  extra_unit_label,
  extra_unit_price,
  calculation_type,
  show_in_generate_links
)
select
  'eb2-installment-initial-payment',
  'EB-2 Installment Plan - Initial Payment',
  coalesce(
    description,
    'Initial payment for the EB-2 Installment Plan.'
  ),
  base_price_usd,
  price_per_dependent_usd,
  is_active,
  allow_extra_units,
  extra_unit_label,
  extra_unit_price,
  calculation_type,
  show_in_generate_links
from public.visa_products
where slug = 'eb2-niw-initial-payment'
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  base_price_usd = excluded.base_price_usd,
  price_per_dependent_usd = excluded.price_per_dependent_usd,
  is_active = excluded.is_active,
  allow_extra_units = excluded.allow_extra_units,
  extra_unit_label = excluded.extra_unit_label,
  extra_unit_price = excluded.extra_unit_price,
  calculation_type = excluded.calculation_type,
  show_in_generate_links = excluded.show_in_generate_links,
  updated_at = now();
