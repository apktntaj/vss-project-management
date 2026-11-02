-- Mengapa: koreksi 2026-11-02 dari contoh inward manifest klien (bagian ROAD SHIPMENT berisi blok
-- "AGENT : EASYGO" dst.). Road Shipment boleh dipegang agent maupun exhibitor; hanya job LOCAL
-- yang selalu dipegang exhibitor. Aturan "satu pihak" (agent XOR exhibitor) tetap berlaku.
alter table public.jobs drop constraint jobs_exhibitor_only_party;
alter table public.jobs add constraint jobs_exhibitor_only_party
  check (agent_id is null or kind <> 'LOCAL');
