-- Taksonomi jenis job 2026-10-29: TEMPORARY dipecah menjadi TPPB_BC_23 (venue berikat)
-- dan TEMPORARY_IMPORT (impor sementara biasa). Data lama dipetakan ke TEMPORARY_IMPORT
-- (perubahan nama murni); job TPPB dibuat baru sejak taksonomi ini.
update public.jobs
set payload = jsonb_set(payload, '{internationalJenis}', '"TEMPORARY_IMPORT"'::jsonb)
where payload->>'internationalJenis' = 'TEMPORARY';
