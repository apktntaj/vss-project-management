# Otorisasi job per event — Design

Notasi dan tabel terjemahan: `AGENTS.md`, bagian "Default delivery workflow".

| Bagian | Pemilik | Status |
|---|---|---|
| Data | Pak Kur (ditulis Bebe) | ☑ disetujui pengguna (20 Nov) |
| Backend | Bima | ☑ contoh fungsi puncak disetujui pengguna (20 Nov, peran baru) |
| UI | Dicha | ☑ contoh komponen puncak disetujui pengguna (20 Nov, pola pudar + alasan) |
| Storage | Bima | ☐ |

## Data

Definisi data B6 yang disetujui pengguna (20 Nov; requirements.md, "Keputusan pengguna" dan
"Model peran"). Tipe teknis lapisan otorisasi (bukan entitas) ditandai "teknis".

```racket
;; Role is one of:                                   ; BERUBAH (domain/auth/types.ts)
;;  - 'CS          ; customer service; PIC event
;;  - 'SPESIALIS   ; memegang jenis job tertentu (mis. Road Shipment) di event yang ia diberi akses
;;  - 'FINANCE     ; baca semua + tagihan
;; interpretation: peran kerja pengguna; admin adalah flag terpisah (is-admin) di atas peran
;; ROLE_LABELS: CS 'CS (PIC event)', SPESIALIS 'Spesialis', FINANCE 'Finance'

;; JobJenis is one of:                               ; BARU (domain/job/types.ts)
;;  - 'TPPB_BC_23 - 'ATA_CARNET - 'TEMPORARY_IMPORT - 'PERMANENT_IMPORT - 'ROAD_SHIPMENT
;;  - 'LOCAL
;; interpretation: jenis job yang bisa dibuat: sub-jenis International, atau Local
;; TS: export const jobJenisValues = [...internationalJobJenisValues, 'LOCAL'] as const
;;     export type JobJenis = (typeof jobJenisValues)[number]
(define JOB-JENIS (list 'TPPB_BC_23 'ATA_CARNET 'TEMPORARY_IMPORT 'PERMANENT_IMPORT
                        'ROAD_SHIPMENT 'LOCAL))

;; Pengguna (domain/user/types.ts `User`, tabel app_users) BERUBAH: tambah field
;;   handled-job-jenis : [List-of JobJenis]
;; interpretation: jenis job yang dipegang seorang spesialis
;; invariant: role = 'SPESIALIS  =>  handled-job-jenis tidak kosong
;; invariant: role /= 'SPESIALIS =>  handled-job-jenis kosong
;; invariant: tanpa duplikat

;; Job.createdById BERUBAH makna:
;; interpretation: PEMILIK job. Job masuk/Local/Road: pengguna yang membuatnya. Job turunan
;;   (stage DISPOSAL/RE_EXPORT): pemilik job masuknya.
;; invariant: job turunan: created-by-id = created-by-id job sumbernya
;; invariant: diisi server saat insert, tidak pernah diubah lewat jalur tulis mana pun

;; --- teknis (features/auth/write-scope.ts) ---

;; Actor is (make-actor UserId Role Boolean)
;; interpretation: bagian pengguna yang dibaca keputusan otorisasi; `CurrentUser` server dan
;;   `session.user` klien sama-sama memenuhi bentuk ini
;; TS: type Actor = Pick<CurrentUser, 'id' | 'role' | 'isAdmin'>
(define-struct actor (id role is-admin))

;; JobWriteCapability is one of: 'job:create 'job:update 'job:cancel
;; TS: dipindah dari job-guards.ts ke write-scope.ts, bentuk sama

;; EventRelation is one of:
;;  - 'PIC       ; pengguna adalah PIC event
;;  - 'GRANTEE   ; pengguna diberi akses event (baris event_access), bukan PIC
;;  - 'NONE
;; invariant: 'PIC menang atas 'GRANTEE

;; JobWriteScope is one of:
;;  - 'ALL    ; semua job di event itu
;;  - 'OWN    ; hanya job yang created-by-id-nya pengguna itu
;;  - 'NONE

;; EventAccessEntry is (make-event-access-entry EventId EventRelation)
;; invariant: relation tidak pernah 'NONE; satu entri per event-id
(define-struct event-access-entry (event-id relation))

;; MyWriteAccess is (make-my-write-access [List-of EventAccessEntry] [List-of JobJenis])
;; interpretation: bekal UI untuk pengguna yang login: kaitannya dengan event, dan jenis job
;;   yang ia pegang (kosong kecuali spesialis)
(define-struct my-write-access (events handled-job-jenis))

;; (20 Nov: ExhibitorLink dihapus bersama 'SHARED. Tanpa 'SHARED, keputusan exhibitor tidak lagi
;;  butuh daftar semua job yang merujuk exhibitor; cukup pemilik job perantara dan apakah exhibitor
;;  tercantum di job itu.)

;; ExhibitorUpdateVerdict is one of:
;;  - 'ALLOWED
;;  - 'JOB_NOT_WRITABLE   ; job perantara bukan milik pengguna
;;  - 'NOT_LINKED         ; exhibitor tidak tercantum di job perantara
;; (20 Nov: 'SHARED dihapus. Hall/booth tetap di master exhibitor event; ubahan lewat satu job ikut
;;  terlihat di job lain yang memakai exhibitor itu. Efek ini diterima sampai fase 2.)
```

## Backend

### Ringkasan

- Satu modul murni, `features/auth/write-scope.ts` (bersebelahan dengan `capabilities.ts`, tanpa
  `server-only`, aman di klien), memegang seluruh keputusan "siapa boleh menulis event, job, dan
  exhibitor". Guard server dan UI memakai fungsi yang sama.
- **Tabel peran baru** (`capabilities.ts`): CS, SPESIALIS, FINANCE; admin tetap flag `is_admin`
  yang melewati tabel. Pola tetap "peran dulu, lalu guard per-objek": capability menyatakan peran
  *boleh* melakukan jenis tindakan itu, kaitan dengan event menentukan *objek mana*.
- **Pengelola event** = admin atau PIC (CS). Penerima akses tidak lagi mengelola event.
- **Buat event, EO, venue** = admin saja (`event:create`, `reference:create` dicabut dari CS).
- **Tulis job**: cakupan `'ALL` (admin, PIC), `'OWN` (penerima akses ber-peran CS/SPESIALIS: hanya
  job miliknya), `'NONE`. FINANCE tidak pernah menulis job, walau diberi akses.
- **Spesialis** hanya boleh membuat job dari jenis yang ia pegang, dan hanya di event yang ia diberi
  akses.
- **Job turunan BC 2.5/3.0** dimiliki pembuat job masuknya: `created_by_id` disalin dari job masuk
  saat dibuat, dan data lama diselaraskan lewat migrasi.
- **Exhibitor**: PIC/admin bebas di eventnya. Penerima akses hanya **lewat job miliknya**:
  - membuat exhibitor baru untuk CIPL job itu;
  - mengubah exhibitor yang tercantum di job itu (sebagai pihak job atau di baris CIPL), walau
    exhibitor itu juga dipakai job milik orang lain (keputusan pengguna 20 Nov, sesi implementasi:
    aturan `'SHARED` dihapus, efek lintas job pada hall/booth diterima sampai fase 2).
- **Calon penerima akses**: hanya CS dan SPESIALIS non-admin, disaring di server dan dijaga saat
  memberi akses.
- **Celah ditutup**:
  - `PUT /api/jobs/[id]/inward` dan `POST /api/attachments` kini ikut aturan ubah job;
  - `POST /api/events/[id]/agents` kini hanya PIC/admin.
- **Kontrak UI**: satu endpoint baca `GET /api/account/write-access` ditambah fungsi murni yang
  di-re-export `lib/data-client`. Tipe `Job` dan event tidak berubah.
- **Titik perluasan B3 (genco, belum didesain)**: job tanpa event belum ada. Saat B3 datang,
  `EventRelation` di `job-write-scope` digeneralisasi menjadi kaitan pengguna dengan *konteks* job.
  Di sana aturan spesialis (jenis yang dipegang, job milik sendiri) dipakai ulang tanpa syarat
  diberi akses event.

### Data yang dibutuhkan

Lihat `## Data` di atas (sumber tunggal; tidak diulang di sini).

Nilai contoh untuk semua `check-expect` (event "IIMS 2026", PIC Budi; Rina dan Yudi diberi akses
oleh Budi):

```racket
(define AYU   (make-actor "u-ayu"   'CS        #true))   ; admin
(define BUDI  (make-actor "u-budi"  'CS        #false))  ; PIC IIMS 2026
(define RINA  (make-actor "u-rina"  'CS        #false))  ; CS lain, penerima akses IIMS 2026
(define TONO  (make-actor "u-tono"  'CS        #false))  ; CS tanpa kaitan dengan IIMS
(define YUDI  (make-actor "u-yudi"  'SPESIALIS #false))  ; spesialis Road Shipment, penerima akses IIMS
(define PUTRI (make-actor "u-putri" 'SPESIALIS #false))  ; spesialis Permanent Import, tanpa akses IIMS
(define FAJAR (make-actor "u-fajar" 'FINANCE   #false))
(define YUDI-JENIS  (list 'ROAD_SHIPMENT))
(define PUTRI-JENIS (list 'PERMANENT_IMPORT))
;; Pemilik job: "u-rina" = job buatan Rina, "u-budi" = job S.01 buatan Budi,
;; "u-yudi" = job Road Shipment buatan Yudi, #false = job lama tanpa pemilik tercatat.
```

### Fungsi puncak

Murni, di `features/auth/write-scope.ts`. Contohnya adalah "output yang diharapkan".

```racket
;; can-write-job-in-event : Actor JobWriteCapability EventRelation [Maybe UserId] -> Boolean
;; purpose: apakah pengguna boleh melakukan `cap` (ubah, batal, atau buat turunan) pada job milik
;;   `created-by`, di event yang kaitannya dengan pengguna adalah `relation`
;; PIC: semua job di eventnya
(check-expect (can-write-job-in-event BUDI 'job:update 'PIC "u-rina") #true)
(check-expect (can-write-job-in-event BUDI 'job:cancel 'PIC "u-yudi") #true)
;; penerima akses (CS atau spesialis): job miliknya saja
(check-expect (can-write-job-in-event RINA 'job:update 'GRANTEE "u-rina") #true)
(check-expect (can-write-job-in-event RINA 'job:cancel 'GRANTEE "u-rina") #true)
(check-expect (can-write-job-in-event RINA 'job:update 'GRANTEE "u-budi") #false)
(check-expect (can-write-job-in-event RINA 'job:update 'GRANTEE #false) #false)   ; job lama tanpa pemilik
(check-expect (can-write-job-in-event YUDI 'job:update 'GRANTEE "u-yudi") #true)
(check-expect (can-write-job-in-event YUDI 'job:cancel 'GRANTEE "u-rina") #false)
;; bekas penerima akses: job miliknya pun tidak bisa diubah lagi
(check-expect (can-write-job-in-event RINA 'job:update 'NONE "u-rina") #false)
;; tanpa kaitan
(check-expect (can-write-job-in-event TONO 'job:update 'NONE "u-budi") #false)
(check-expect (can-write-job-in-event PUTRI 'job:update 'NONE "u-putri") #false)
;; FINANCE tidak menulis job, walau diberi akses
(check-expect (can-write-job-in-event FAJAR 'job:update 'NONE "u-budi") #false)
(check-expect (can-write-job-in-event FAJAR 'job:update 'GRANTEE "u-fajar") #false)
;; admin
(check-expect (can-write-job-in-event AYU 'job:cancel 'NONE "u-budi") #true)

(define (can-write-job-in-event a cap relation created-by)
  (can-write-job (job-write-scope a cap relation) (actor-id a) created-by))
```

```racket
;; can-create-job-in-event : Actor [List-of JobJenis] EventRelation [Maybe JobJenis] -> Boolean
;; purpose: apakah pengguna yang memegang `handled` boleh membuat job baru berjenis `jenis` di event
;;   yang kaitannya `relation`
(check-expect (can-create-job-in-event RINA '() 'GRANTEE 'TPPB_BC_23) #true)       ; CS penerima: jenis apa pun
(check-expect (can-create-job-in-event RINA '() 'NONE 'ROAD_SHIPMENT) #false)      ; event tanpa akses
(check-expect (can-create-job-in-event BUDI '() 'PIC 'ATA_CARNET) #true)
(check-expect (can-create-job-in-event TONO '() 'NONE 'LOCAL) #false)
(check-expect (can-create-job-in-event AYU '() 'NONE 'PERMANENT_IMPORT) #true)
(check-expect (can-create-job-in-event YUDI YUDI-JENIS 'GRANTEE 'ROAD_SHIPMENT) #true)  ; jenisnya, diberi akses
(check-expect (can-create-job-in-event YUDI YUDI-JENIS 'GRANTEE 'TPPB_BC_23) #false)    ; jenis lain
(check-expect (can-create-job-in-event PUTRI PUTRI-JENIS 'NONE 'PERMANENT_IMPORT) #false) ; tanpa akses
(check-expect (can-create-job-in-event FAJAR '() 'GRANTEE 'LOCAL) #false)

(define (can-create-job-in-event a handled relation jenis)
  (and (can-create-job (job-write-scope a 'job:create relation))
       (jenis-allowed? a handled jenis)))
```

```racket
;; can-manage-event : Actor Capability [Maybe UserId] -> Boolean
;; purpose: apakah pengguna boleh melakukan tindakan kelola `cap` pada event ber-PIC `pic-id`:
;;   'event:update (ubah, arsip, surat penunjukan, daftarkan agent), 'event:cancel, 'event:delete,
;;   'event:access:manage, 'exhibitor:write (exhibitor event secara umum)
(check-expect (can-manage-event BUDI 'event:update "u-budi") #true)
(check-expect (can-manage-event BUDI 'event:access:manage "u-budi") #true)
(check-expect (can-manage-event BUDI 'exhibitor:write "u-budi") #true)
(check-expect (can-manage-event RINA 'event:update "u-budi") #false)    ; penerima akses: tidak lagi
(check-expect (can-manage-event RINA 'event:cancel "u-budi") #false)
(check-expect (can-manage-event RINA 'event:delete "u-budi") #false)
(check-expect (can-manage-event YUDI 'exhibitor:write "u-budi") #false) ; exhibitor hanya lewat job miliknya
(check-expect (can-manage-event AYU 'event:delete "u-budi") #true)
(check-expect (can-manage-event AYU 'event:update #false) #true)        ; event tanpa PIC: admin saja
(check-expect (can-manage-event TONO 'event:update #false) #false)
(check-expect (can-manage-event FAJAR 'event:update "u-budi") #false)

(define (can-manage-event a cap pic-id)
  (and (role-sufficient? a cap)
       (event-manager? a pic-id)))
```

```racket
;; exhibitor-update-verdict : JobWriteScope UserId [Maybe UserId] Boolean -> ExhibitorUpdateVerdict
;; purpose: keputusan mengubah exhibitor LEWAT satu job perantara milik `via-owner`, oleh pengguna
;;   `user-id` dengan cakupan `scope` di event exhibitor; `linked?` = exhibitor tercantum di job
;;   perantara itu (sebagai pihak job atau di baris CIPL-nya).
;;   PIC/admin tidak memakai fungsi ini: mereka lolos di jalur exhibitor event (can-manage-event).
;;   (20 Nov: 'SHARED dihapus; job lain yang memakai exhibitor tidak lagi diperiksa.)
;; Contoh: R.01 = job Rina, S.01 = job Budi. ACME hanya di CIPL R.01; BETA di CIPL R.01 dan S.01;
;;   GAMMA hanya di CIPL S.01.
;; Rina mengubah ACME lewat R.01; juga BETA lewat R.01 (boleh walau BETA dipakai S.01 milik Budi:
;;   job lain tidak memengaruhi vonis, jadi kedua kasus satu assertion)
(check-expect (exhibitor-update-verdict 'OWN "u-rina" "u-rina" #true) 'ALLOWED)
;; Rina mengubah GAMMA lewat R.01: GAMMA tidak ada di R.01
(check-expect (exhibitor-update-verdict 'OWN "u-rina" "u-rina" #false) 'NOT_LINKED)
;; Rina mengubah GAMMA lewat S.01 (job Budi)
(check-expect (exhibitor-update-verdict 'OWN "u-rina" "u-budi" #true) 'JOB_NOT_WRITABLE)
;; Rina lewat job lama tanpa pemilik tercatat
(check-expect (exhibitor-update-verdict 'OWN "u-rina" #false #true) 'JOB_NOT_WRITABLE)
;; Tono (tanpa akses) lewat S.01
(check-expect (exhibitor-update-verdict 'NONE "u-tono" "u-budi" #true) 'JOB_NOT_WRITABLE)
;; job bukan milik pengguna diperiksa lebih dulu daripada keterkaitan
(check-expect (exhibitor-update-verdict 'OWN "u-rina" "u-budi" #false) 'JOB_NOT_WRITABLE)
;; cakupan 'ALL (PIC/admin bila lewat jalur ini)
(check-expect (exhibitor-update-verdict 'ALL "u-budi" "u-rina" #true) 'ALLOWED)

(define (exhibitor-update-verdict scope user-id via-owner linked?)
  (cond [(not (can-write-job scope user-id via-owner)) 'JOB_NOT_WRITABLE]
        [(not linked?) 'NOT_LINKED]
        [else 'ALLOWED]))
;; TS: exhibitorUpdateVerdict(scope, userId, viaOwnerId: string | null, linked: boolean)
```

### Wishlist

Semua item didesain di bawah. Wishlist kosong.

- [x] `can : Role Capability -> Boolean` (tabel peran BERUBAH)
- [x] `role-sufficient? : Actor Capability -> Boolean`
- [x] `event-manager? : Actor [Maybe UserId] -> Boolean`
- [x] `event-relation : UserId [Maybe UserId] Boolean -> EventRelation`
- [x] `job-write-scope : Actor JobWriteCapability EventRelation -> JobWriteScope`
- [x] `can-write-job : JobWriteScope UserId [Maybe UserId] -> Boolean`
- [x] `can-create-job : JobWriteScope -> Boolean`
- [x] `jenis-of : JobKind [Maybe InternationalJobJenis] -> [Maybe JobJenis]`
- [x] `jenis-allowed? : Actor [List-of JobJenis] [Maybe JobJenis] -> Boolean`
- [x] `creatable-jenis-in-event : Actor [List-of JobJenis] EventRelation -> [List-of JobJenis]`
- [x] `job-write-denial : JobWriteScope -> String`
- [x] `exhibitor-update-message : JobWriteScope ExhibitorUpdateVerdict -> String`
- [x] `merge-event-access : [List-of EventId] [List-of EventId] -> [List-of EventAccessEntry]`
- [x] `relation-in : [List-of EventAccessEntry] EventId -> EventRelation`
- [x] `exhibitor-linked-to-job? : ExhibitorId JobId -> [IO Boolean]` (lapisan tepi; menggantikan
      `list-exhibitor-links` dan `dedupe-links`, yang dihapus bersama `'SHARED` per 20 Nov)
- [x] `grantable-target? : Role Boolean -> Boolean`
- [x] `grant-target-error : [Maybe GrantTarget] [Maybe UserId] UserId -> [Maybe String]`
- [x] `normalize-handled-jenis : Role [List-of JobJenis] -> [List-of JobJenis]`
- [x] `handled-jenis-error : Role [List-of JobJenis] -> [Maybe String]`

#### Tabel peran (`features/auth/capabilities.ts`, BERUBAH)

Union `Capability` tidak berubah. `ROLE_CAPABILITIES` diganti:

| Capability | CS | SPESIALIS | FINANCE | Guard per-objek tambahan |
|---|---|---|---|---|
| `event:read`, `job:read` | ya | ya | ya | - |
| `event:create`, `reference:create` | - | - | - | admin saja (lewat `isAdmin`) |
| `event:update`, `event:cancel`, `event:delete`, `event:access:manage` | ya | - | - | PIC/admin (`event-manager?`) |
| `job:create`, `job:update`, `job:cancel` | ya | ya | - | `job-write-scope` (PIC `'ALL`, penerima `'OWN`) |
| `exhibitor:write` | ya | ya | - | PIC/admin, atau lewat job milik sendiri |
| `job:invoice:write` | - | - | ya | - |

```racket
;; can : Role Capability -> Boolean
;; purpose: apakah peran dipetakan ke capability di tabel; peran tak dikenal (token lama) -> #false
(check-expect (can 'CS 'event:update) #true)
(check-expect (can 'CS 'event:create) #false)
(check-expect (can 'CS 'reference:create) #false)
(check-expect (can 'CS 'job:update) #true)
(check-expect (can 'SPESIALIS 'job:create) #true)
(check-expect (can 'SPESIALIS 'exhibitor:write) #true)
(check-expect (can 'SPESIALIS 'event:update) #false)
(check-expect (can 'SPESIALIS 'job:invoice:write) #false)
(check-expect (can 'FINANCE 'job:invoice:write) #true)
(check-expect (can 'FINANCE 'job:update) #false)
(check-expect (can 'FINANCE 'event:read) #true)
(check-expect (can 'STAFF 'job:read) #false)         ; peran yang dihapus
;; TS: return ROLE_CAPABILITIES[role]?.has(capability) ?? false
```

Tes tabel lama di `features/auth/auth.config.test.ts` (blok `can(...)` untuk STAFF/OPERATIONS/
DOCUMENT_ASSISTANT dan tabel tiruan) ditulis ulang mengikuti contoh di atas. Fixture `role: 'STAFF'`
di tes JWT/sesi diganti `'SPESIALIS'`.

#### Fungsi murni lain (`features/auth/write-scope.ts`, semua di-export)

```racket
;; role-sufficient? : Actor Capability -> Boolean
;; purpose: apakah admin atau tabel peran mengizinkan jenis tindakan `cap`
(check-expect (role-sufficient? AYU 'event:create) #true)
(check-expect (role-sufficient? BUDI 'event:create) #false)
(check-expect (role-sufficient? BUDI 'reference:create) #false)
(check-expect (role-sufficient? BUDI 'event:update) #true)
(check-expect (role-sufficient? YUDI 'job:create) #true)
(check-expect (role-sufficient? FAJAR 'job:update) #false)
(check-expect (role-sufficient? FAJAR 'job:invoice:write) #true)
(define (role-sufficient? a cap)
  (or (actor-is-admin a) (can (actor-role a) cap)))
;; TS: isRoleSufficient(actor, capability)
```

```racket
;; event-manager? : Actor [Maybe UserId] -> Boolean
;; purpose: apakah pengguna pengelola event ber-PIC `pic-id` (admin atau PIC-nya)
(check-expect (event-manager? BUDI "u-budi") #true)
(check-expect (event-manager? RINA "u-budi") #false)
(check-expect (event-manager? AYU "u-budi") #true)
(check-expect (event-manager? TONO #false) #false)
(define (event-manager? a pic-id)
  (or (actor-is-admin a)
      (and (string? pic-id) (string=? pic-id (actor-id a)))))
;; TS: isEventManager(actor, picId)
```

```racket
;; event-relation : UserId [Maybe UserId] Boolean -> EventRelation
;; purpose: kaitan pengguna dengan event ber-PIC `pic-id`, diberi tahu apakah ada baris akses
(check-expect (event-relation "u-budi" "u-budi" #false) 'PIC)
(check-expect (event-relation "u-budi" "u-budi" #true) 'PIC)
(check-expect (event-relation "u-rina" "u-budi" #true) 'GRANTEE)
(check-expect (event-relation "u-rina" #false #true) 'GRANTEE)
(check-expect (event-relation "u-tono" "u-budi" #false) 'NONE)
(define (event-relation user-id pic-id granted?)
  (cond [(and (string? pic-id) (string=? pic-id user-id)) 'PIC]
        [granted? 'GRANTEE]
        [else 'NONE]))
;; TS: eventRelation(userId, picId, granted)
```

```racket
;; job-write-scope : Actor JobWriteCapability EventRelation -> JobWriteScope
;; purpose: cakupan job yang boleh ditulis pengguna untuk `cap` di event berkaitan `relation`
(check-expect (job-write-scope AYU 'job:cancel 'NONE) 'ALL)
(check-expect (job-write-scope BUDI 'job:update 'PIC) 'ALL)
(check-expect (job-write-scope RINA 'job:update 'GRANTEE) 'OWN)
(check-expect (job-write-scope YUDI 'job:create 'GRANTEE) 'OWN)
(check-expect (job-write-scope TONO 'job:update 'NONE) 'NONE)
(check-expect (job-write-scope FAJAR 'job:update 'GRANTEE) 'NONE)   ; peran tanpa capability
(define (job-write-scope a cap relation)
  (cond [(actor-is-admin a) 'ALL]
        [(not (can (actor-role a) cap)) 'NONE]
        [else
         (cond [(symbol=? relation 'PIC) 'ALL]
               [(symbol=? relation 'GRANTEE) 'OWN]
               [(symbol=? relation 'NONE) 'NONE])]))
;; TS: jobWriteScope(actor, capability, relation); cond dalam = switch exhaustive dengan `never`
```

```racket
;; can-write-job : JobWriteScope UserId [Maybe UserId] -> Boolean
;; purpose: apakah cakupan `scope` milik `user-id` mencakup job milik `created-by`
(check-expect (can-write-job 'ALL "u-budi" "u-rina") #true)
(check-expect (can-write-job 'ALL "u-budi" #false) #true)
(check-expect (can-write-job 'OWN "u-rina" "u-rina") #true)
(check-expect (can-write-job 'OWN "u-rina" "u-budi") #false)
(check-expect (can-write-job 'OWN "u-rina" #false) #false)
(check-expect (can-write-job 'NONE "u-tono" "u-tono") #false)
(define (can-write-job scope user-id created-by)
  (cond [(symbol=? scope 'ALL) #true]
        [(symbol=? scope 'OWN) (and (string? created-by) (string=? created-by user-id))]
        [(symbol=? scope 'NONE) #false]))
;; TS: canWriteJob(scope, userId, createdById); switch exhaustive
```

```racket
;; can-create-job : JobWriteScope -> Boolean
;; purpose: apakah cakupan cukup untuk membuat job baru (job baru selalu milik pembuatnya)
(check-expect (can-create-job 'ALL) #true)
(check-expect (can-create-job 'OWN) #true)
(check-expect (can-create-job 'NONE) #false)
(define (can-create-job scope)
  (cond [(symbol=? scope 'ALL) #true]
        [(symbol=? scope 'OWN) #true]
        [(symbol=? scope 'NONE) #false]))
;; TS: canCreateJob(scope); switch exhaustive
```

```racket
;; jenis-of : JobKind [Maybe InternationalJobJenis] -> [Maybe JobJenis]
;; purpose: jenis job dari bentuk masukan pembuatan job; International tanpa jenis -> #false
(check-expect (jenis-of 'LOCAL #false) 'LOCAL)
(check-expect (jenis-of 'INTERNATIONAL 'ROAD_SHIPMENT) 'ROAD_SHIPMENT)
(check-expect (jenis-of 'INTERNATIONAL #false) #false)
(define (jenis-of kind international-jenis)
  (cond [(symbol=? kind 'LOCAL) 'LOCAL]
        [(symbol=? kind 'INTERNATIONAL) international-jenis]))
;; TS: jenisOf(kind, internationalJenis): JobJenis | null; switch exhaustive
```

```racket
;; jenis-allowed? : Actor [List-of JobJenis] [Maybe JobJenis] -> Boolean
;; purpose: apakah peran pengguna (yang memegang `handled`) tidak membatasi pembuatan job `jenis`.
;;   Hanya spesialis yang dibatasi; hak membuat job di event diputuskan job-write-scope.
(check-expect (jenis-allowed? AYU '() 'ROAD_SHIPMENT) #true)
(check-expect (jenis-allowed? BUDI '() 'ATA_CARNET) #true)
(check-expect (jenis-allowed? YUDI YUDI-JENIS 'ROAD_SHIPMENT) #true)
(check-expect (jenis-allowed? YUDI YUDI-JENIS 'LOCAL) #false)
(check-expect (jenis-allowed? YUDI YUDI-JENIS #false) #false)
(check-expect (jenis-allowed? FAJAR '() 'LOCAL) #true)
(define (jenis-allowed? a handled jenis)
  (cond [(actor-is-admin a) #true]
        [(symbol=? (actor-role a) 'SPESIALIS)
         (and (symbol? jenis) (member? jenis handled))]
        [else #true]))
;; TS: isJenisAllowed(actor, handled, jenis)
```

```racket
;; creatable-jenis-in-event : Actor [List-of JobJenis] EventRelation -> [List-of JobJenis]
;; purpose: jenis job yang boleh dibuat pengguna di event berkaitan `relation`, urut JOB-JENIS
;;   (pilihan di wizard New Job; kosong = tombol New Job tampil pudar dengan alasan)
(check-expect (creatable-jenis-in-event YUDI YUDI-JENIS 'GRANTEE) (list 'ROAD_SHIPMENT))
(check-expect (creatable-jenis-in-event YUDI YUDI-JENIS 'NONE) '())
(check-expect (creatable-jenis-in-event RINA '() 'GRANTEE) JOB-JENIS)
(check-expect (creatable-jenis-in-event TONO '() 'NONE) '())
(check-expect (creatable-jenis-in-event FAJAR '() 'GRANTEE) '())
(check-expect (creatable-jenis-in-event AYU '() 'NONE) JOB-JENIS)
(define (creatable-jenis-in-event a handled relation)
  (cond [(can-create-job (job-write-scope a 'job:create relation))
         (filter (lambda (j) (jenis-allowed? a handled j)) JOB-JENIS)]
        [else '()]))
;; TS: creatableJenisInEvent(actor, handled, relation): JobJenis[]
```

```racket
;; job-write-denial : JobWriteScope -> String
;; purpose: pesan 403 (toast gagal) saat tulis job ditolak dengan cakupan `scope`
(check-expect (job-write-denial 'OWN)
              "Penerima akses event hanya dapat mengubah job miliknya sendiri.")
(check-expect (job-write-denial 'NONE)
              "Anda tidak memiliki izin untuk melakukan tindakan ini.")
(check-expect (job-write-denial 'ALL)
              "Anda tidak memiliki izin untuk melakukan tindakan ini.")   ; tidak pernah ditolak; total
(define (job-write-denial scope)
  (cond [(symbol=? scope 'OWN) "Penerima akses event hanya dapat mengubah job miliknya sendiri."]
        [(symbol=? scope 'NONE) "Anda tidak memiliki izin untuk melakukan tindakan ini."]
        [(symbol=? scope 'ALL) "Anda tidak memiliki izin untuk melakukan tindakan ini."]))
```

```racket
;; exhibitor-update-message : JobWriteScope ExhibitorUpdateVerdict -> String
;; purpose: pesan 403 untuk vonis yang menolak; 'ALLOWED -> "" (tidak dipakai)
(check-expect (exhibitor-update-message 'OWN 'JOB_NOT_WRITABLE)
              "Penerima akses event hanya dapat mengubah job miliknya sendiri.")
(check-expect (exhibitor-update-message 'OWN 'NOT_LINKED)
              "Exhibitor ini tidak tercantum di job tersebut. Simpan CIPL job dulu, lalu ubah exhibitor.")
(check-expect (exhibitor-update-message 'ALL 'ALLOWED) "")
;; (20 Nov: pesan 'SHARED dihapus bersama variannya)
(define (exhibitor-update-message scope verdict)
  (cond [(symbol=? verdict 'JOB_NOT_WRITABLE) (job-write-denial scope)]
        [(symbol=? verdict 'NOT_LINKED)
         "Exhibitor ini tidak tercantum di job tersebut. Simpan CIPL job dulu, lalu ubah exhibitor."]
        [(symbol=? verdict 'ALLOWED) ""]))
;; TS: switch exhaustive dengan `never`
```

```racket
;; merge-event-access : [List-of EventId] [List-of EventId] -> [List-of EventAccessEntry]
;; purpose: gabungkan event yang dipegang sebagai PIC dan event yang aksesnya diberikan; satu entri
;;   per event, 'PIC menang, entri PIC lebih dulu
(check-expect (merge-event-access '() '()) '())
(check-expect (merge-event-access (list "e-iims") (list "e-gjaw"))
              (list (make-event-access-entry "e-iims" 'PIC)
                    (make-event-access-entry "e-gjaw" 'GRANTEE)))
(check-expect (merge-event-access (list "e-iims") (list "e-iims" "e-gjaw"))
              (list (make-event-access-entry "e-iims" 'PIC)
                    (make-event-access-entry "e-gjaw" 'GRANTEE)))
(define (merge-event-access pic-ids granted-ids)
  (append (map (lambda (id) (make-event-access-entry id 'PIC)) pic-ids)
          (map (lambda (id) (make-event-access-entry id 'GRANTEE))
               (filter (lambda (id) (not (member? id pic-ids))) granted-ids))))
```

```racket
;; relation-in : [List-of EventAccessEntry] EventId -> EventRelation
;; purpose: kaitan pengguna dengan `event-id` menurut daftar aksesnya; tidak tercantum = 'NONE
(define ACCESS-RINA (list (make-event-access-entry "e-gjaw" 'PIC)
                          (make-event-access-entry "e-iims" 'GRANTEE)))
(check-expect (relation-in ACCESS-RINA "e-gjaw") 'PIC)
(check-expect (relation-in ACCESS-RINA "e-iims") 'GRANTEE)
(check-expect (relation-in ACCESS-RINA "e-lain") 'NONE)
(check-expect (relation-in '() "e-iims") 'NONE)
(define (relation-in entries event-id)
  (cond [(empty? entries) 'NONE]
        [(string=? (event-access-entry-event-id (first entries)) event-id)
         (event-access-entry-relation (first entries))]
        [else (relation-in (rest entries) event-id)]))
```

#### Calon penerima akses (`features/auth/write-scope.ts`)

Keputusan pengguna 20 Nov: calon penerima akses hanya CS dan SPESIALIS. Akses event hanya berguna
untuk menulis job, jadi peran yang boleh menerima akses diturunkan dari tabel peran (`job:create`),
bukan didaftar ulang. Admin tidak perlu akses karena sudah memegang semuanya.

```racket
;; GrantTarget is (make-grant-target Role Boolean)          ; teknis
;; interpretation: peran dan flag admin calon penerima akses yang masih anggota aktif workspace
(define-struct grant-target (role is-admin))

;; grantable-target? : Role Boolean -> Boolean
;; purpose: apakah pengguna dengan peran `role` (dan flag admin `is-admin`) boleh diberi akses event
(check-expect (grantable-target? 'CS #false) #true)
(check-expect (grantable-target? 'SPESIALIS #false) #true)
(check-expect (grantable-target? 'FINANCE #false) #false)
(check-expect (grantable-target? 'CS #true) #false)          ; admin sudah memegang semuanya
(define (grantable-target? role is-admin)
  (and (not is-admin) (can role 'job:create)))
;; TS: isGrantableTarget(role, isAdmin)

;; grant-target-error : [Maybe GrantTarget] [Maybe UserId] UserId -> [Maybe String]
;; purpose: pesan 400 bila `target-id` (yang datanya `target`, #false bila bukan anggota aktif)
;;   tidak boleh diberi akses event ber-PIC `pic-id`; #false bila boleh
(check-expect (grant-target-error (make-grant-target 'CS #false) "u-budi" "u-rina") #false)
(check-expect (grant-target-error (make-grant-target 'SPESIALIS #false) "u-budi" "u-yudi") #false)
(check-expect (grant-target-error (make-grant-target 'CS #false) "u-budi" "u-budi")
              "PIC event sudah memiliki akses penuh.")
(check-expect (grant-target-error #false "u-budi" "u-x")
              "Pengguna bukan anggota workspace.")
(check-expect (grant-target-error (make-grant-target 'FINANCE #false) "u-budi" "u-fajar")
              "Akses event hanya dapat diberikan kepada CS atau Spesialis.")
(check-expect (grant-target-error (make-grant-target 'CS #true) "u-budi" "u-ayu")
              "Admin sudah memiliki akses penuh ke semua event.")
(define (grant-target-error target pic-id target-id)
  (cond [(and (string? pic-id) (string=? pic-id target-id)) "PIC event sudah memiliki akses penuh."]
        [(false? target) "Pengguna bukan anggota workspace."]
        [(grant-target-is-admin target) "Admin sudah memiliki akses penuh ke semua event."]
        [(not (grantable-target? (grant-target-role target) #false))
         "Akses event hanya dapat diberikan kepada CS atau Spesialis."]
        [else #false]))
;; TS: grantTargetError(target, picId, targetId): string | null
```

Lapisan tepi (BERUBAH):

```racket
;; find-active-member : UserId -> [IO [Maybe GrantTarget]]
;; purpose: peran + flag admin pengguna bila ia anggota AKTIF workspace; #false bila tidak
;; file: features/events/repository/event-access.ts; MENGGANTI isActiveWorkspaceMember (satu-satunya
;;   pemakainya grantEventAccess). Query sama, select menambah `role, is_admin`, `.maybeSingle()`.
;; TS: findActiveMember(userId): Promise<{ role: Role; isAdmin: boolean } | null>

;; list-grant-candidates : -> [IO [List-of MemberOption]]
;; purpose: anggota aktif workspace yang boleh diberi akses: bukan admin, peran dengan 'job:create
;; file: features/auth/repository.ts, export lewat features/auth/index.ts
;; query: pola queryMemberOptions + `.eq('is_admin', false).in('role', GRANTABLE_ROLES)`, dengan
;;   GRANTABLE_ROLES = (filter (lambda (r) (grantable-target? r #false)) ROLES)  ; = CS, SPESIALIS
;; TS: listGrantCandidates(): Promise<{ id: string; fullName: string }[]>

;; grant-event-access : CurrentUser EventId UserId -> [IO Void]
;; file: features/events/use-cases/manage-event-access.ts
(define (grant-event-access u event-id user-id)
  (local [(define event (authorize-event-manager u 'event:access:manage event-id))
          (define error (grant-target-error (find-active-member user-id)
                                            (event-row-pic-id event) user-id))]
    (cond [(string? error) (raise-400 error)]
          [else (insert-event-access event-id user-id (current-user-id u))])))
;; menggantikan dua cek lama (PIC, anggota aktif) dengan satu fungsi murni

;; list-event-access : CurrentUser EventId -> [IO EventAccessView]
;; perubahan: `listWorkspaceMembers()` diganti `listGrantCandidates()`; filter PIC dan yang sudah
;;   diberi tetap. Bentuk EventAccessView tidak berubah.
```

Penerima akses lama yang perannya kemudian menjadi FINANCE tidak dicabut otomatis. Barisnya tetap
ada, tetapi tidak memberi hak apa pun (`job-write-scope` = `'NONE`), dan PIC masih bisa mencabutnya.

#### Fungsi murni pengguna (`domain/user/validation.ts`)

Invariant modul: `domain/user/validation.ts` murni dan aman di klien. Ia tidak mengimpor
`server-only`, `features/**`, `lib/server/**`, atau Supabase, hanya `zod`, `@/domain/auth/types`,
dan `@/domain/job/types`. Formulir Settings di klien memakai `handledJenisError` dan
`normalizeHandledJenis` dari modul ini.

```racket
;; normalize-handled-jenis : Role [List-of JobJenis] -> [List-of JobJenis]
;; purpose: daftar jenis yang disimpan: kosong untuk non-spesialis, tanpa duplikat untuk spesialis
(check-expect (normalize-handled-jenis 'CS (list 'ROAD_SHIPMENT)) '())
(check-expect (normalize-handled-jenis 'SPESIALIS
                                       (list 'ROAD_SHIPMENT 'ROAD_SHIPMENT 'PERMANENT_IMPORT))
              (list 'ROAD_SHIPMENT 'PERMANENT_IMPORT))
(check-expect (normalize-handled-jenis 'SPESIALIS '()) '())
(define (normalize-handled-jenis role handled)
  (cond [(symbol=? role 'SPESIALIS)
         (foldr (lambda (j acc) (cons j (remove-all j acc))) '() handled)]
        [else '()]))
;; TS: normalizeHandledJenis(role, handled); dedupe dengan Set, urutan kemunculan pertama
```

```racket
;; handled-jenis-error : Role [List-of JobJenis] -> [Maybe String]
;; purpose: pesan validasi bila spesialis tidak memegang satu jenis pun
(check-expect (handled-jenis-error 'SPESIALIS '()) "Spesialis wajib memegang minimal satu jenis job.")
(check-expect (handled-jenis-error 'SPESIALIS (list 'LOCAL)) #false)
(check-expect (handled-jenis-error 'CS '()) #false)
(check-expect (handled-jenis-error 'FINANCE (list 'LOCAL)) #false)   ; dinormalisasi jadi kosong
(define (handled-jenis-error role handled)
  (cond [(and (symbol=? role 'SPESIALIS) (empty? handled))
         "Spesialis wajib memegang minimal satu jenis job."]
        [else #false]))
```

Skema Zod di `domain/user/validation.ts`:
- `UserSchema` (tetap `z.object`, supaya `.extend` dan `.shape` di pemakai tetap jalan) mendapat
  field `handledJobJenis: z.array(z.enum(jobJenisValues)).default([])`.
- Export baru `userCreateSchema = UserSchema.superRefine(checkHandledJenis).transform(normalizeUser)`.
- Export baru `userUpdateSchema = UserSchema.extend({ password: z.string().min(1, 'Password wajib diisi.').optional() }).superRefine(checkHandledJenis).transform(normalizeUser)`.
- `checkHandledJenis(input, ctx)`: bila `handledJenisError(input.role, input.handledJobJenis)` tidak
  null, tambahkan issue di path `['handledJobJenis']`.
- `normalizeUser(input)`: `{ ...input, handledJobJenis: normalizeHandledJenis(input.role, input.handledJobJenis) }`.

Tes:
- `features/auth/write-scope.test.ts` BARU berisi semua `check-expect` write-scope.
- Contoh `normalize-handled-jenis` dan `handled-jenis-error` masuk ke `domain/user/validation.test.ts`
  yang sudah ada.
- File tes baru ditambahkan ke skrip `domain:test`.

### Lapisan tepi

#### Event: guard pengelola

```racket
;; event-manager-guard : CurrentUser EventRow -> (-> [IO Boolean])
;; file: features/events/use-cases/event-guards.ts · BERUBAH: hapus cabang hasEventAccess
(define (event-manager-guard u event)
  (lambda () (event-manager? u (event-row-pic-id event))))
;; TS: return async () => isEventManager(currentUser, event.picId)

;; authorize-event-manager : CurrentUser Capability EventId -> [IO EventRow]
;; purpose: muat event (404) lalu authorize `cap` + event-manager-guard; kembalikan event
;; file: event-guards.ts · BARU, export
(define (authorize-event-manager u cap event-id)
  (local [(define event (find-event-by-id event-id))]
    (cond [(false? event) (raise-404 "Event tidak ditemukan.")]
          [else (begin (authorize u cap (event-manager-guard u event)) event)])))
;; TS: authorizeEventManager(currentUser, capability, eventId): Promise<EventRow>
```

- Pemakai `event-manager-guard` lama (kodenya tetap, perilaku berubah: penerima akses kini 403):
  `updateEvent`, `cancelEvent`, `deleteEvent`, `archiveEvent`, `upload/removeAppointmentLetter`.
- `authorizeManage` di `manage-event-access.ts` diganti
  `authorizeEventManager(u, 'event:access:manage', eventId)`; perilakunya sama.
- `authorize` (`features/auth/authorize.ts`): hanya teks 403 kegagalan guard per-objek yang berubah,
  menjadi "Hanya PIC event atau admin yang dapat melakukan tindakan ini."
- `createEvent`, `createVenue`, `createEventOrganizer`: kode tetap
  (`authorize(u, 'event:create'|'reference:create')`). Dengan tabel baru, yang lolos hanya admin.

#### Daftarkan agent ke event (BERUBAH, menutup celah)

```racket
;; add-event-agent : Request -> [IO EventAgentView]
;; route: POST /api/events/[eventId]/agents · file: app/api/events/[eventId]/agents/route.ts
;; otorisasi: requireCurrentUser (401) + authorize-event-manager u 'event:update eventId (404/403)
;; perubahan (POST saja; GET tetap):
;;  1. paling awal di try: const currentUser = await requireCurrentUser()
;;     lalu await authorizeEventManager(currentUser, 'event:update', params.eventId)
;;  2. hapus query cek event `events.select('id')...` (diganti langkah 1)
;;  3. sisa logika tetap (cek agent, idempoten, insert; created_by_id = userId dari konteks)
;;  4. catch: if (error instanceof ApiError) return toErrorResponse(error); else eventApiFailure(error)
```

Pendaftaran agent sebagai efek samping tulis job (`ensureEventAgent` di `createJob` dan
`updateJobDetails`) tidak berubah dan tetap di bawah otorisasi job.

#### Job: guard tulis (`features/jobs/use-cases/job-guards.ts`)

`JobWriteCapability` di-import dari `write-scope.ts`.

```racket
;; load-event-relation : CurrentUser EventId -> [IO EventRelation]
;; purpose: kaitan pengguna dengan satu event menurut storage; event tak ditemukan = 'NONE
;; (non-export)
(define (load-event-relation u event-id)
  (local [(define event (find-event-by-id event-id))]
    (cond [(false? event) 'NONE]
          [else (event-relation (current-user-id u)
                                (event-row-pic-id event)
                                (has-event-access event-id (current-user-id u)))])))

;; load-handled-jenis : CurrentUser -> [IO [List-of JobJenis]]
;; purpose: jenis yang dipegang pengguna; query hanya untuk spesialis non-admin
;; (non-export)
(define (load-handled-jenis u)
  (cond [(and (not (current-user-is-admin u)) (symbol=? (current-user-role u) 'SPESIALIS))
         (find-handled-job-jenis (current-user-id u))]
        [else '()]))
```

```racket
;; authorize-job-create-in-event : CurrentUser EventId [Maybe JobJenis] -> [IO Void]
;; purpose: izinkan membuat job berjenis `jenis` di event, atau lempar 403
;; MENGGANTI authorizeJobWriteInEvent. TS: authorizeJobCreateInEvent(currentUser, eventId, jenis)
(define (authorize-job-create-in-event u event-id jenis)
  (cond [(current-user-is-admin u) (void)]
        [else
         (local [(define scope (job-write-scope u 'job:create (load-event-relation u event-id)))]
           (cond [(not (can-create-job scope)) (raise-403 (job-write-denial scope))]
                 [(not (jenis-allowed? u (load-handled-jenis u) jenis))
                  (raise-403 "Anda hanya dapat membuat job dengan jenis yang Anda pegang.")]
                 [else (void)]))]))
```

```racket
;; authorize-loaded-job-write : CurrentUser JobWriteCapability Job -> [IO Void]
;; purpose: izinkan `cap` pada job yang sudah dimuat, atau lempar 403 · BARU, export
(define (authorize-loaded-job-write u cap job)
  (cond [(current-user-is-admin u) (void)]
        [else
         (local [(define scope (job-write-scope u cap (load-event-relation u (job-event-id job))))]
           (if (can-write-job scope (current-user-id u) (job-created-by-id job))
               (void)
               (raise-403 (job-write-denial scope))))]))

;; authorize-job-write : CurrentUser JobWriteCapability JobId -> [IO Void]
;; purpose: izinkan `cap` pada job `job-id`, atau lempar 404/403 · signature tetap
(define (authorize-job-write u cap job-id)
  (cond [(current-user-is-admin u) (void)]
        [else
         (local [(define job (find-job-by-id job-id))]
           (cond [(false? job) (raise-404 "Job tidak ditemukan.")]
                 [else (authorize-loaded-job-write u cap job)]))]))

;; authorize-job-attachment-write : CurrentUser JobId -> [IO Void]
;; purpose: izinkan menambah lampiran: aturan ubah job + job tidak batal
;; BARU, export lewat features/jobs/index.ts (menggantikan export assertJobAcceptsAttachments,
;;   yang menjadi non-export)
(define (authorize-job-attachment-write u job-id)
  (begin (authorize-job-write u 'job:update job-id)
         (assert-job-accepts-attachments job-id)))
```

Pemakai di use-case job:

| Use-case (file) | Sekarang | Desain |
|---|---|---|
| `createJob` (`create-job.ts`) | `authorizeJobWriteInEvent(u, 'job:create', input.eventId)` | `authorizeJobCreateInEvent(u, input.eventId, jenisOf(input.kind, input.internationalJenis))` |
| `createStageJob` (`stage-jobs.ts`) | `authorizeJobWriteInEvent(u, 'job:create', source.eventId)` | `authorizeLoadedJobWrite(u, 'job:create', source)` sesudah 404 sumber |
| `saveJobInward` (`update-job.ts`) | **tanpa otorisasi** | baris pertama `await authorizeJobWrite(u, 'job:update', jobId)` |
| `updateJobDetails`, `applyJobExtraction`, `saveJobCipl`, `saveJobKepulangan` | `authorizeJobWrite(u, 'job:update', jobId)` | tidak berubah (body guard yang berubah) |
| `cancelJob` | `authorizeJobWrite(u, 'job:cancel', jobId)` | tidak berubah |
| `saveJobInvoice` | `authorize(u, 'job:invoice:write')` | tidak berubah (FINANCE/admin) |

#### Pemilik job turunan (`stage-jobs.ts`, BERUBAH)

```racket
;; insert-stage-job : Job DerivedJobStage -> [IO Job]
;; perubahan: parameter currentUser dihapus; created_by_id = (job-created-by-id inbound)
;;   (dulu currentUser.id). Kolom lain tetap.
;; ensure-stage-jobs : Job -> [IO Void]
;; perubahan: signature menjadi ensureStageJobs(inbound); pemanggil saveJobCipl menyesuaikan.
;; create-stage-job : CurrentUser JobId DerivedJobStage -> [IO Job]
;; perubahan: guard seperti tabel di atas; insertStageJob(source, stage).
```

Akibatnya:
- Bila PIC menyimpan CIPL job masuk milik Rina, job turunannya tetap milik Rina.
- Penerima akses boleh membuat dan mengubah turunan dari job masuk miliknya.
- `features/jobs/index.ts` tetap meng-export `ensureStageJobs`, dengan signature baru.

#### Route lampiran (`app/api/attachments/route.ts`, BERUBAH)

```racket
;; route: POST /api/attachments · otorisasi: sesi (401) + authorize-job-attachment-write (403/404/409)
;;  1. ganti cek `auth()` dengan `const currentUser = await requireCurrentUser()` di dalam try
;;  2. validasi form tetap (400 'Lampiran tidak valid.')
;;  3. ganti `assertJobAcceptsAttachments(ownerId)` dengan `authorizeJobAttachmentWrite(currentUser, ownerId)`
;;  4. uploadAttachment tetap
;; GET tidak berubah.
```

Tidak ada jalur hapus lampiran job hari ini. Bila kelak ditambah, wajib memakai
`authorize-job-attachment-write`.

#### Exhibitor (BERUBAH)

Repository job (`features/jobs/repository/job-crud.ts`, BARU, export lewat barrel repository job):

```racket
;; exhibitor-linked-to-job? : ExhibitorId JobId -> [IO Boolean]
;; purpose: apakah job `j` merujuk exhibitor `x`, sebagai pihak job atau di salah satu baris CIPL-nya
;; (20 Nov: menggantikan list-exhibitor-links; tanpa 'SHARED, job lain tidak perlu dimuat)
;; query (paralel, keduanya disaring workspace_id, masing-masing .limit(1)):
;;   jobs.select('id').eq('id', j).eq('exhibitor_id', x)                    ; PK jobs
;;   job_cipl_lines.select('id').eq('job_id', j).eq('exhibitor_id', x)
;;                                    ; unique job_cipl_lines_exhibitor_key (job_id, exhibitor_id)
;;   hasil = salah satu query mengembalikan minimal satu baris; gagal -> raise seperti fungsi
;;   sekitarnya
;; contoh (data IIMS 2026): (ACME, R.01) -> #true; (BETA, S.01) -> #true; (GAMMA, R.01) -> #false;
;;   exhibitor yang menjadi pihak job R.01 tetapi belum ada di CIPL-nya -> #true
;; TS: isExhibitorLinkedToJob(exhibitorId, jobId): Promise<boolean>
```

Use-case `features/exhibitors/use-cases/exhibitors.ts`:

```racket
;; create-exhibitors : CurrentUser EventId [List-of ExhibitorCreateInput] [Maybe JobId]
;;                     -> [IO [List-of Exhibitor]]
;; purpose: daftarkan exhibitor di event; tanpa via-job hanya PIC/admin, dengan via-job lewat job
;;   milik pengguna di event yang sama
(define (create-exhibitors u event-id inputs via-job-id)
  (local [(define event (find-event-by-id event-id))]
    (cond [(false? event) (raise-404 "Event tidak ditemukan.")]
          [else
           (begin
             (authorize u 'exhibitor:write)                              ; peran dulu
             (cond [(event-manager? u (event-row-pic-id event)) (void)]
                   [(false? via-job-id)
                    (raise-403 "Hanya PIC event atau admin yang dapat mengelola exhibitor event. Tambahkan exhibitor lewat CIPL job Anda.")]
                   [else (authorize-via-job u 'job:update via-job-id event-id)])
             (insert-exhibitors event-id inputs (current-user-id u)))])))

;; authorize-via-job : CurrentUser JobWriteCapability JobId EventId -> [IO Job]
;; purpose: muat job perantara, pastikan ia di event itu dan belum batal, lalu izinkan `cap`
;;   (non-export)
(define (authorize-via-job u cap job-id event-id)
  (local [(define job (find-job-by-id job-id))]
    (cond [(false? job) (raise-404 "Job tidak ditemukan.")]
          [(not (string=? (job-event-id job) event-id))
           (raise-400 "Job tidak berada di event exhibitor ini.")]
          [else (begin (assert-not-cancelled job)                        ; 409, sudah ada
                       (authorize-loaded-job-write u cap job)
                       job)])))
```

```racket
;; update-exhibitor : CurrentUser ExhibitorId ExhibitorUpdateInput [Maybe JobId] -> [IO Exhibitor]
;; purpose: ubah exhibitor; tanpa via-job hanya PIC/admin; dengan via-job sesuai
;;   exhibitor-update-verdict
(define (update-exhibitor u exhibitor-id patch via-job-id)
  (local [(define current (find-exhibitor-by-id exhibitor-id))]
    (cond [(false? current) (raise-404 "Exhibitor tidak ditemukan.")]
          [else
           (local [(define event (find-event-by-id (exhibitor-event-id current)))]
             (begin
               (authorize u 'exhibitor:write)
               (cond [(and event (event-manager? u (event-row-pic-id event))) (void)]
                     [(false? via-job-id)
                      (raise-403 "Hanya PIC event atau admin yang dapat mengelola exhibitor event. Ubah exhibitor lewat CIPL job Anda.")]
                     [else (authorize-exhibitor-via-job u current via-job-id)])
               ... ; validasi NPWP + tulis kolom: TIDAK BERUBAH
               ))])))

;; authorize-exhibitor-via-job : CurrentUser Exhibitor JobId -> [IO Void]
;; (non-export)
(define (authorize-exhibitor-via-job u exhibitor via-job-id)
  (local [(define job (find-job-by-id via-job-id))]
    (cond [(false? job) (raise-404 "Job tidak ditemukan.")]
          [(not (string=? (job-event-id job) (exhibitor-event-id exhibitor)))
           (raise-400 "Job tidak berada di event exhibitor ini.")]
          [else
           (begin
             (assert-not-cancelled job)
             (local [(define scope (if (current-user-is-admin u)
                                       'ALL
                                       (job-write-scope u 'job:update
                                                        (load-event-relation u (job-event-id job)))))
                     (define verdict (exhibitor-update-verdict
                                      scope (current-user-id u)
                                      (job-created-by-id job)
                                      (exhibitor-linked-to-job? (exhibitor-id exhibitor)
                                                                (job-id job))))]
               (if (symbol=? verdict 'ALLOWED)
                   (void)
                   (raise-403 (exhibitor-update-message scope verdict)))))])))
```

`load-event-relation` dan `authorize-loaded-job-write` di-export dari `job-guards.ts` untuk dipakai
use-case exhibitor.

Route:
- `POST /api/events/[eventId]/exhibitors`: baca query `viaJobId` dengan
  `z.string().uuid().optional()`; body tetap array; panggil
  `createExhibitors(u, eventId, inputs, viaJobId ?? null)`.
- `PATCH /api/exhibitors/[exhibitorId]`: baca query `viaJobId` dengan cara yang sama; panggil
  `updateExhibitor(u, id, patch, viaJobId ?? null)`.
- GET tidak berubah.

#### Akses tulis saya (BARU)

```racket
;; list-event-ids-by-pic : UserId -> [IO [List-of EventId]]
;;   file: features/events/repository/event-access.ts; query events.select('id')
;;   .eq('workspace_id', ws).eq('pic_id', userId) (index events_workspace_pic_idx)
;; list-granted-event-ids : UserId -> [IO [List-of EventId]]
;;   file: event-access.ts; query event_access.select('event_id').eq('workspace_id', ws)
;;   .eq('user_id', userId) (index event_access_user_idx)
;; find-handled-job-jenis : UserId -> [IO [List-of JobJenis]]
;;   file: features/auth/repository.ts, export lewat features/auth/index.ts; query
;;   app_users.select('handled_job_jenis, workspace_members!inner(workspace_id)').eq('id', userId)
;;   .eq('workspace_members.workspace_id', ws); tidak ditemukan -> '()
;; Ketiganya: gagal -> throw Error('Gagal memuat akses: ...') (503 lewat toErrorResponse)
```

```racket
;; get-my-write-access : CurrentUser -> [IO MyWriteAccess]
;; purpose: kaitan pengguna login dengan event + jenis job yang ia pegang
;; file: features/events/use-cases/my-write-access.ts (BARU), export lewat features/events/index.ts
;; otorisasi: 'event:read (semua peran); hanya data milik sesi sendiri, tanpa parameter userId
(define (get-my-write-access u)
  (begin (authorize u 'event:read)
         (make-my-write-access
          (merge-event-access (list-event-ids-by-pic (current-user-id u))     ; ketiganya paralel
                              (list-granted-event-ids (current-user-id u)))
          (load-handled-jenis u))))          ; logika sama dengan job-guards; panggil find-handled-job-jenis bila spesialis
;; TS: getMyWriteAccess(currentUser): Promise<MyWriteAccess>
;;   MyWriteAccess = { readonly events: readonly EventAccessEntry[]; readonly handledJobJenis: readonly JobJenis[] }

;; GET /api/account/write-access -> [IO MyWriteAccess]
;; file: app/api/account/write-access/route.ts · requireCurrentUser (401) -> use-case -> 200 JSON,
;;   Cache-Control: no-store · runtime 'nodejs', dynamic 'force-dynamic'
```

#### Settings → Pengguna (`app/api/settings/route.ts`, BERUBAH, admin saja seperti sekarang)

- **POST users**: parse dengan `userCreateSchema`, ganti `UserSchema.parse`. Insert menambah
  `handled_job_jenis: input.handledJobJenis`.
- **PATCH users**: parse dengan `userUpdateSchema` dari domain; hapus `userUpdateSchema` lokal.
  Update menambah `handled_job_jenis: input.handledJobJenis`. Cek "PIC harus CS" tetap.
- **GET users dan respons POST/PATCH**: select menambah `handled_job_jenis`, dan setiap objek
  pengguna menambah `handledJobJenis: row.handled_job_jenis`.
- **Galat validasi `handledJobJenis`**: bila parse users gagal dengan issue berpath
  `['handledJobJenis']`, respons berstatus 400 dengan body
  `{ error: <pesan issue>, field: 'handledJobJenis' }`. Galat lain tetap `{ error }` lewat
  `failure`. Caranya:
  - parse users memakai `safeParse`;
  - fungsi murni lokal `settingsValidationBody : ZodError -> { error, field? }` mengambil issue
    pertama, dan menambahkan `field: 'handledJobJenis'` hanya bila `path[0]` adalah
    `'handledJobJenis'`;
  - jalur demo (`addDemoUser`/`updateDemoUser`) mengembalikan bentuk yang sama.

  Contoh `settingsValidationBody`:
  - issue path `['handledJobJenis']`, pesan "Spesialis wajib memegang minimal satu jenis job." →
    `{ error: "Spesialis wajib memegang minimal satu jenis job.", field: 'handledJobJenis' }`
  - issue path `['email']`, pesan "Format email tidak valid." →
    `{ error: "Format email tidak valid." }`

  Kontrak data-client: `settingsRequest` melempar `SettingsValidationError extends Error` dengan
  properti `field: 'handledJobJenis' | null` (diisi dari body); pesan tetap `error`. Pemanggil lama
  yang hanya membaca `message` tidak terpengaruh.
- **Demo users** (`lib/demo-users.ts`):
  - `User` mendapat `handledJobJenis`.
  - `MOCK_USERS`: Andy menjadi `role: 'CS', handledJobJenis: []`; dua pengguna lain mendapat
    `handledJobJenis: []`.
  - `addDemoUser` memakai `userCreateSchema`, `updateDemoUser` memakai `userUpdateSchema`, dan
    keduanya menyalin `handledJobJenis`.
- **`scripts/create-supabase-user.ts`**: enum peran menjadi `['CS','SPESIALIS','FINANCE']` dengan
  default `'CS'`.

Catatan sesi: peran tersimpan di JWT. Perubahan peran seseorang baru berlaku setelah ia login ulang.
Ini perilaku yang sudah ada; tidak ada perubahan pada `auth.ts`, `middleware.ts`, atau
`features/auth/auth.config.ts`.

#### Kontrak `lib/data-client` (untuk Dicha)

Tipe `Job`, `LocalEvent`, `EventListItem` tidak berubah. Kontrak `listMyEventAccess` /
`GET /api/events/my-access` dari draf sebelumnya **dibatalkan** dan diganti fungsi di bawah.

```racket
;; get-my-write-access : -> [IO MyWriteAccess]
;; route: GET /api/account/write-access
;; TS: export function getMyWriteAccess(): Promise<MyWriteAccess>  (via eventsRequest)

;; create-event-exhibitors : EventId [List-of ExhibitorInput] [Maybe JobId] -> [IO [List-of Exhibitor]]
;; BERUBAH: argumen ketiga opsional `viaJobId`; dikirim sebagai query `?viaJobId=`
;; TS: createEventExhibitors(eventId, inputs, viaJobId?: string)

;; update-exhibitor : ExhibitorId ExhibitorPatch [Maybe JobId] -> [IO Exhibitor]
;; BERUBAH: argumen ketiga opsional `viaJobId`; dikirim sebagai query `?viaJobId=`
;; TS: updateExhibitor(exhibitorId, patch, viaJobId?: string)

;; apply-cipl-autofill : ... -> [IO CiplAutofillOutcome]
;; BERUBAH urutan dan hasil:
;;  1. exhibitor baru dibuat dengan viaJobId = job.id
;;  2. saveJobCipl (baris tertaut ke exhibitor lama dan baru)
;;  3. lengkapi hall/booth exhibitor lama yang kosong, masing-masing updateExhibitor(..., job.id),
;;     dengan Promise.allSettled. Yang gagal dicatat namanya, tidak membatalkan hasil.
;; CiplAutofillOutcome menambah field
;;   unfilledExhibitors : [List-of String]  ; nama exhibitor yang hall/booth-nya tidak dapat dilengkapi
```

`unfilledExhibitors` **dipertahankan** (20 Nov) sebagai jaring pengaman `Promise.allSettled`: setelah
`'SHARED` dihapus, penolakan izin praktis tidak terjadi (CIPL baru tersimpan bila pengguna boleh
menulis job, dan exhibitornya otomatis tercantum di job itu), sehingga daftar ini hanya terisi oleh
kegagalan lain seperti jaringan, validasi, atau akses dicabut di tengah proses; bentuk kontraknya
tidak berubah, tetapi Dicha perlu mengganti kalimat "Exhibitor yang juga dipakai job lain hanya
dapat diubah PIC event." di `unfilled-exhibitors-message` serta contoh UI yang mengandaikan ACME
ditolak karena dipakai S.01 milik Budi.

`SettingsUser` menambah `handledJobJenis: JobJenis[]`. Input pengguna untuk
`createSettingsRecord`/`updateSettingsRecord('users', ...)` menambah `handledJobJenis`.

Re-export dari `@/features/auth/write-scope` (murni, aman di klien):

```ts
export type {
  Actor, EventAccessEntry, EventRelation, JobWriteScope, MyWriteAccess,
} from '@/features/auth/write-scope'
export {
  canCreateJobInEvent, canManageEvent, canWriteJobInEvent, creatableJenisInEvent,
  isRoleSufficient, relationIn,
} from '@/features/auth/write-scope'
export { jobJenisValues, type JobJenis } from '@/domain/job/types'
```

Resep pemakaian (bukan desain komponen). `access = await getMyWriteAccess()` sekali per halaman;
`relation = relationIn(access.events, eventId)`; `actor` dari `useSession().data?.user`. Bila `id`
atau `role` sesi kosong, anggap tidak boleh menulis.

| Kebutuhan UI | Ekspresi |
|---|---|
| Ubah job (header, catatan, CIPL, dokumen, lampiran, pabean, kepulangan, inward) | `canWriteJobInEvent(actor, 'job:update', relation, job.createdById)` |
| Batalkan job | `canWriteJobInEvent(actor, 'job:cancel', relation, job.createdById)` |
| Buat job turunan (kartu rangkaian) | `canWriteJobInEvent(actor, 'job:create', relation, sourceJob.createdById)` |
| Tombol New Job; event yang bisa dipilih di wizard | `creatableJenisInEvent(actor, access.handledJobJenis, relation).length > 0` |
| Pilihan jenis di wizard | `creatableJenisInEvent(actor, access.handledJobJenis, relation)` |
| Tombol Event baru; buat venue/EO inline di form event | `isRoleSufficient(actor, 'event:create')` / `isRoleSufficient(actor, 'reference:create')` |
| Edit/arsip event, surat penunjukan | `canManageEvent(actor, 'event:update', event.picId)` |
| Batalkan / hapus event | `canManageEvent(actor, 'event:cancel' / 'event:delete', event.picId)` |
| Kartu akses event | `canManageEvent(actor, 'event:access:manage', event.picId)` |
| Edit tagihan | tetap `useCanEditBilling()` |

Exhibitor dari dalam job: selalu kirim `viaJobId = job.id`. Server mengizinkan PIC/admin tanpa
melihat job, dan penerima akses lewat job miliknya.

### Bagian UI yang dibutuhkan (untuk Dicha, didesain Dicha)

- **Settings → Pengguna**: pilihan peran CS / Spesialis / Finance (`ROLE_LABELS`). Pilihan jenis
  job (multi, dari `jobJenisValues`) tampil dan wajib minimal satu bila Spesialis. Daftar pengguna
  menampilkan jenis yang dipegang. Galat validasi tampil di dekat field.
- **Daftar event**: tombol Event baru hanya untuk admin. Menu kartu event (edit, arsip, hapus) hanya
  bila `canManageEvent`. Form event: buat venue/EO inline hanya untuk admin.
- **Detail event**: tombol New Job, aksi ubah dan batal per baris job, dan kartu akses event
  digerbang sesuai resep di atas. Teks kartu akses diubah: penerima akses kini "dapat membuat job
  dan mengurus job miliknya", bukan "mengelola event".
- **Detail job**: tombol Ubah header, aksi tab, catatan, CIPL, unggah dokumen, kartu pabean, menu
  Batalkan job, dan tombol buat job turunan tampil pudar dengan alasan saat dicoba bila tidak boleh (pola di `## UI`).
- **Wizard New Job** (halaman event dan `/jobs`): event yang bisa dipilih dan jenis yang ditawarkan
  memakai `creatableJenisInEvent`. Tombol Job baru di `/jobs` tampil bila ada minimal satu event
  dengan jenis yang bisa dibuat.
- **`CiplLineModal`**: urutan baru. Buat exhibitor baru (dengan `viaJobId`), simpan baris CIPL,
  lalu ubah hall/booth exhibitor yang dipilih (dengan `viaJobId`). Cara menampilkan
  `unfilledExhibitors` dari autofill juga diputuskan di sini. Sejak 20 Nov (`'SHARED` dihapus),
  ubah hall/booth lewat job milik sendiri tidak lagi ditolak karena exhibitor dipakai job lain;
  pesan 403 yang tersisa hanya `'JOB_NOT_WRITABLE` dan `'NOT_LINKED`.

### Jalur tulis dan guard-nya

Job:

| Route | Use-case | Guard sekarang | Guard desain |
|---|---|---|---|
| `POST /api/jobs` | `createJob` | peran luas, atau PIC/penerima | `authorizeJobCreateInEvent` (cakupan + jenis spesialis) |
| `PATCH /api/jobs/[id]` | `updateJobDetails` | `authorizeJobWrite('job:update')` | sama, body baru |
| `POST /api/jobs/[id]/cancel` | `cancelJob` | `authorizeJobWrite('job:cancel')` | sama, body baru |
| `PUT /api/jobs/[id]/cipl` (+ `ensureStageJobs`) | `saveJobCipl` | `authorizeJobWrite('job:update')` | sama; turunan otomatis milik pemilik job masuk |
| `POST /api/jobs/[id]/extraction` | `applyJobExtraction` | `authorizeJobWrite('job:update')` | sama, body baru |
| `PUT /api/jobs/[id]/kepulangan` | `saveJobKepulangan` | `authorizeJobWrite('job:update')` | sama, body baru |
| `PUT /api/jobs/[id]/inward` | `saveJobInward` | **tidak ada** | `authorizeJobWrite('job:update')` |
| `POST /api/jobs/[id]/stage-jobs` | `createStageJob` | `authorizeJobWriteInEvent('job:create')` | `authorizeLoadedJobWrite('job:create', source)` |
| `PUT /api/jobs/[id]/invoice` | `saveJobInvoice` | `authorize('job:invoice:write')` | sama |
| `POST /api/attachments` (JOB) | route | sesi saja + job tidak batal | `authorizeJobAttachmentWrite` |

Bukan jalur tulis (tidak berubah): `GET /api/jobs`, `GET /api/jobs/[id]`,
`POST /api/jobs/[id]/kanwil-letter` (hanya membuat PDF), `GET /api/jobs/[id]/tppb-goods-form`,
`GET /api/attachments`.

Event dan data event:

| Route | Use-case | Capability (peran) | Guard per-objek desain |
|---|---|---|---|
| `POST /api/events` | `createEvent` | `event:create` (admin saja) | - |
| `POST /api/references/venues`, `/event-organizers` | `createVenue`, `createEventOrganizer` | `reference:create` (admin saja) | - |
| `PATCH /api/events/[id]` | `updateEvent` | `event:update` (CS) | PIC/admin |
| `POST /api/events/[id]/cancel` | `cancelEvent` | `event:cancel` (CS) | PIC/admin |
| `DELETE /api/events/[id]` | `deleteEvent` | `event:delete` (CS) | PIC/admin |
| `POST /api/events/[id]/archive` | `archiveEvent` | `event:update` (CS) | PIC/admin |
| `POST`/`DELETE .../appointment-letter` | `upload/removeAppointmentLetter` | `event:update` (CS) | PIC/admin |
| `GET`/`POST`/`DELETE .../access` | `list/grant/revokeEventAccess` | `event:access:manage` (CS) | PIC/admin (sama seperti sekarang) |
| `POST /api/events/[id]/agents` | route | `event:update` (CS) | PIC/admin (dulu: tanpa otorisasi) |
| `POST /api/events/[id]/exhibitors` | `createExhibitors` | `exhibitor:write` (CS, SPESIALIS) | PIC/admin, atau `viaJobId` milik sendiri |
| `PATCH /api/exhibitors/[id]` | `updateExhibitor` | `exhibitor:write` (CS, SPESIALIS) | PIC/admin, atau `exhibitor-update-verdict` |
| `/api/settings` | inline | `isAdmin` | tidak berubah, kecuali field `handledJobJenis` |

### Catatan implementasi

- `jobs.created_by_id` tidak boleh masuk `JobWritableColumns`.
- `updateEvent` tetap memeriksa "ganti PIC hanya oleh PIC/admin". Pemeriksaan ini kini redundan,
  tetapi dibiarkan.
- Komentar yang disesuaikan:
  - header `event-guards.ts`, `manage-event-access.ts`, `job-guards.ts`;
  - komentar intent `capabilities.ts` (ditulis ulang untuk CS/SPESIALIS/FINANCE);
  - docstring use-case event dan referensi yang menyebut "penerima akses" atau "CS/STAFF";
  - JSDoc akses event di `lib/data-client.ts`.
- `write-scope.ts` hanya mengimpor `./capabilities` dan tipe dari `@/domain/auth/types` serta
  `@/domain/job/types`. Tidak boleh ada `server-only`.

## Storage

Satu migrasi baru, forward dan idempotent. Nama file dibuat Bebe dengan
`supabase migration new role_spesialis_dan_pemilik_job_turunan`. Migrasi lama tidak diubah.
Menerapkan ke database remote butuh izin pengguna.

| Tabel | Perubahan | Constraint / index | RLS |
|---|---|---|---|
| `app_users` | Data: `update ... set role = 'CS', job_role = 'CS' where role in ('STAFF','OPERATIONS','DOCUMENT_ASSISTANT') or job_role in (...)`. Per 20 Nov tidak ada baris yang terkena; ini hanya pengaman. | `drop constraint if exists app_users_role_check` lalu add `check (role in ('CS','SPESIALIS','FINANCE'))`; sama untuk `app_users_job_role_check` pada `job_role` | tidak berubah |
| `app_users` | Kolom baru `handled_job_jenis text[] not null default '{}'` (`add column if not exists`) | `app_users_handled_job_jenis_values_check`: `handled_job_jenis <@ array['TPPB_BC_23','ATA_CARNET','TEMPORARY_IMPORT','PERMANENT_IMPORT','ROAD_SHIPMENT','LOCAL']::text[]`. `app_users_handled_job_jenis_role_check`: `(role = 'SPESIALIS') = (cardinality(handled_job_jenis) > 0)`. Keduanya `drop constraint if exists` lalu `add`. Tanpa duplikat dijaga Zod. Tanpa index (tidak dipakai menyaring). | tidak berubah |
| `jobs` | Data: selaraskan pemilik job turunan, `update public.jobs d set created_by_id = s.created_by_id from public.jobs s where d.source_job_id = s.id and d.created_by_id is distinct from s.created_by_id` | Trigger `jobs_block_update_when_cancelled` mengabaikan `created_by_id`, jadi job batal ikut terupdate. Invariant lintas baris tidak dijaga constraint; penjaganya `insertStageJob` + migrasi ini. | tidak berubah |
| `events`, `event_access`, `job_cipl_lines`, `exhibitors` | tidak ada | Dipakai index yang sudah ada: `events_workspace_pic_idx`, `event_access_user_idx`, PK `event_access`, PK `jobs`, unique `job_cipl_lines_exhibitor_key (job_id, exhibitor_id)` (20 Nov: cek keterkaitan exhibitor kini per job, bukan daftar semua job) | tidak berubah |

Urutan dalam migrasi: remap peran → ganti dua check peran → tambah kolom (semua baris kosong,
belum ada SPESIALIS, sehingga check role/jenis langsung terpenuhi) → tambah dua check jenis →
update `jobs`.

Konsekuensi data: job lama dengan `created_by_id` null hanya bisa ditulis admin dan PIC event.

## UI

Desainer: Dicha. Kontrak yang dipakai: "Backend > Kontrak `lib/data-client`". Tidak ada dependency
baru dan tidak ada perubahan token desain global.

### Ringkasan

Revisi 20 Nov (komentar pengguna 4): catatan baca-saja dihapus. Alasan tidak boleh mengubah hanya
muncul saat pengguna mencoba mengubah.

- **Pola "tampil, jelaskan saat dicoba"** untuk semua tombol tulis **job** (detail job, baris job,
  New Job / Job baru):
  - tombol tetap dirender di tempat yang sama, untuk semua orang;
  - bila pengguna tidak boleh, tombol tampil nonaktif lewat `aria-disabled="true"`, **bukan**
    atribut `disabled`. Tombol tetap bisa difokus (Tab), diklik, disentuh, dan diaktifkan dengan
    Enter/Spasi;
  - saat dicoba, aksi tidak berjalan (dialog tidak terbuka, server tidak dipanggil). Yang muncul
    hanya satu toast `'error'` di kanan bawah berisi alasannya (`deny-write`);
  - toast identik tidak menumpuk (`ToastViewport` sudah mengganti pesan yang sama), jadi klik
    berulang aman;
  - alasan dihasilkan satu fungsi murni, `job-write-denial-reason`, yang membedakan job milik
    orang lain, bekas penerima akses, Finance, job lama tanpa pemilik, hak gagal dimuat, dan sedang
    memuat.
- **Kenapa toast, bukan tooltip atau catatan tetap:** tooltip tidak terbaca di layar sentuh dan
  tidak muncul untuk keyboard tanpa kerja tambahan; catatan tetap ditolak pengguna. Toast sudah
  menjadi saluran umpan balik tunggal di repo (AGENTS.md) dan toast `'error'` diumumkan pembaca
  layar (`role="alert"`).
- **Yang tetap disembunyikan** (pengelolaan, bukan pekerjaan pada job sendiri):
  - tombol **Event baru** bagi non-admin: hanya admin yang boleh, berdasarkan peran; tombol mati
    di halaman yang dibuka semua orang setiap hari hanya menjadi gangguan;
  - **menu ⋮ kelola event** (Edit, Arsipkan, Hapus) di baris `/events` bagi yang bukan PIC/admin:
    tabel event dibaca semua orang, dan tombol mati di setiap baris tidak membantu siapa pun. Menu
    ini tidak berisi aksi baca;
  - **kartu Akses event** bagi yang bukan PIC/admin: kartu ini adalah alat pengelolaan, dan
    datanya (daftar penerima, calon) hanya boleh dibaca pengelola (`GET .../access`);
  - **"Ubah" Tagihan** bagi non-Finance: perilaku yang ada, di luar B6, tidak diubah;
  - **job batal**: pola yang ada (tombol tulis hilang, banner "Job dibatalkan… tidak dapat diubah
    lagi"); banner itu sudah menjelaskan.
- **Kontrol formulir yang tampil sebagai data** (form pabean): field `disabled` sebagai tampilan
  baca, seperti job batal. Bedanya, tombol Simpan tetap tampil nonaktif dan menjelaskan saat
  dicoba.
- **Sumber hak:**
  - Server Component (`/events`) memakai `CurrentUser` server dan mengimpor fungsi murni langsung
    dari `@/features/auth/write-scope`. Ekspor modul `'use client'` (`lib/data-client`) tidak bisa
    dipanggil di server.
  - Client Component memakai hook baru `useWriteAccess`, yang memuat `getMyWriteAccess()` sekali
    per halaman, ditambah fungsi murni di `lib/write-access.ts`.
- **Selama hak dimuat**, tombol tulis job sudah dirender dalam keadaan nonaktif (alasan "masih
  dimuat"), lalu aktif setelah siap. Tata letak tidak bergeser. Bila hak gagal dimuat, tombol tetap
  nonaktif dengan alasan "tidak dapat dimuat"; hook tidak lagi menampilkan toast sendiri.
- **Semua mutasi tetap memberi toast** sukses dan gagal (kanan bawah, lewat `toast`/`notify` yang
  ada). Pesan 403 dari server (mis. "Penerima akses event hanya dapat mengubah job miliknya
  sendiri.") tetap ditampilkan apa adanya di toast gagal, sebagai jaring pengaman bila hak berubah
  saat halaman terbuka.
- **Warna:** tidak ada teks oranye. Tampilan nonaktif memakai `aria-disabled:opacity-50
  aria-disabled:cursor-not-allowed`, setara `disabled:opacity-50` di `.btn`. Tombol oranye
  (`btn-primary`) tetap oranye pudar (permukaan, bukan teks). Butir menu nonaktif memakai
  `text-slate-500`, bukan rose.

Temuan di kode yang memengaruhi cakupan (bukan perubahan desain):

| Temuan | Akibat untuk B6 |
|---|---|
| Form event (`features/events/components/event-form-modal.tsx`) **tidak punya** buat venue/EO inline; venue/EO hanya dipilih dari daftar. `components/event-form-modal.tsx` (versi lama) tidak dipakai. | Tidak ada yang perlu digerbang. Bebe tidak boleh menambah buat inline. |
| Tidak ada UI "Batalkan event" di mana pun. | Tidak ada yang digerbang. Tidak ditambah di B6. |
| `EventAccessCard` **tidak dipasang di halaman mana pun**, jadi PIC saat ini tidak bisa memberi akses lewat UI. | Dipasang di detail event, di bawah daftar job (lihat `EventDetailPage`). Disetujui pengguna (20 Nov, Pertanyaan UI 1). |
| `CiplLineModal` dan `JobManifestEditorModal` (satu-satunya UI inward/kepulangan) **tidak dipasang** di halaman mana pun. | `CiplLineModal` tetap didesain sesuai permintaan, dengan perubahan urutan simpan. Inward/kepulangan tidak punya tombol hidup untuk digerbang. Bila modal dipasang lagi, pemicunya wajib berupa `GuardedButton` dengan `update-denial`. |
| Lampiran job hanya diunggah dari `JobDocumentEditorDialog` dan `CiplEntryModal`, keduanya dibuka lewat tombol tab action. | Menggerbang tombol tab action (alasan saat dicoba) sudah menggerbang unggah lampiran. |

### Contoh pengguna dan data UI

Memakai nilai contoh Bima (`AYU`, `BUDI`, `RINA`, `TONO`, `YUDI`, `FAJAR`, `YUDI-JENIS`). Event
"IIMS 2026" (`"e-iims"`, PIC Budi) dan "GJAW 2026" (`"e-gjaw"`, PIC Rina).

```racket
;; WriteAccess is one of:
;;  - (make-wa-loading)
;;  - (make-wa-ready Actor MyWriteAccess)
;;  - (make-wa-unavailable)
;; interpretation: yang diketahui UI tentang hak tulis pengguna login di halaman ini. Selain READY,
;;   tombol tulis job tampil nonaktif dengan alasan "masih dimuat" / "tidak dapat dimuat", dan
;;   tombol yang disembunyikan (kartu Akses event) belum dirender.
;; TS: type WriteAccess = { kind: 'LOADING' } | { kind: 'READY'; actor: Actor; access: MyWriteAccess }
;;                      | { kind: 'UNAVAILABLE' }      ; file lib/write-access.ts
(define-struct wa-loading ())
(define-struct wa-ready (actor access))
(define-struct wa-unavailable ())

;; Denial is one of:
;;  - #false   ; boleh: tombol aktif dan menjalankan aksinya
;;  - String   ; tidak boleh: tombol tampil nonaktif (aria-disabled); String = alasan yang
;;             ;   ditampilkan sebagai toast 'error' saat pengguna mencoba
;; interpretation: keputusan satu tombol tulis, beserta alasannya bila ditolak
;; TS: type Denial = string | null      ; null = boleh
;; invariant: String tidak pernah kosong

;; JobPermissions is (make-job-permissions Denial Denial Denial)
;; interpretation: keputusan tombol tulis untuk satu job
;;   update-denial       : ubah header, catatan, CIPL, dokumen/lampiran, pabean, pihak, B/L-AWB
;;   cancel-denial       : batalkan job
;;   create-stage-denial : buat job turunan dari job ini (kartu rangkaian)
;; TS: type JobPermissions = { readonly updateDenial: Denial; readonly cancelDenial: Denial;
;;                             readonly createStageDenial: Denial }
(define-struct job-permissions (update-denial cancel-denial create-stage-denial))
(define ALL-JOB-PERMISSIONS (make-job-permissions #false #false #false))
;; (denied-all r) = (make-job-permissions r r r) ; hanya singkatan untuk contoh, bukan fungsi kode

;; contoh
(define IIMS-PIC     (make-event-access-entry "e-iims" 'PIC))
(define IIMS-GRANTEE (make-event-access-entry "e-iims" 'GRANTEE))
(define GJAW-PIC     (make-event-access-entry "e-gjaw" 'PIC))
(define WA-AYU   (make-wa-ready AYU   (make-my-write-access '() '())))
(define WA-BUDI  (make-wa-ready BUDI  (make-my-write-access (list IIMS-PIC) '())))
(define WA-RINA  (make-wa-ready RINA  (make-my-write-access (list GJAW-PIC IIMS-GRANTEE) '())))
(define WA-RINA-DICABUT (make-wa-ready RINA (make-my-write-access (list GJAW-PIC) '())))
;;   ; Rina setelah Budi mencabut aksesnya ke IIMS (bekas penerima akses)
(define WA-YUDI  (make-wa-ready YUDI  (make-my-write-access (list IIMS-GRANTEE) YUDI-JENIS)))
(define WA-TONO  (make-wa-ready TONO  (make-my-write-access '() '())))
(define WA-FAJAR (make-wa-ready FAJAR (make-my-write-access '() '())))
(define WA-LOADING (make-wa-loading))
(define WA-GAGAL   (make-wa-unavailable))

;; Teks alasan (konstanta di lib/write-access.ts; dipakai ulang di contoh)
(define MEMUAT      "Hak ubah Anda masih dimuat. Coba lagi sebentar.")
(define GAGAL-MUAT  "Hak ubah Anda tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.")
(define BUKAN-MILIK "Penerima akses event hanya dapat mengubah job miliknya sendiri.")
;;   ; = (job-write-denial 'OWN) milik Bima; sama persis dengan pesan 403 server
(define TANPA-PEMILIK
  "Job ini belum punya pemilik tercatat, jadi hanya dapat diubah PIC event atau admin.")
(define AKSES-DICABUT
  "Anda tidak lagi memiliki akses ke event ini. Minta PIC event memberi akses agar dapat mengubah job ini.")
(define TANPA-AKSES
  "Job ini hanya dapat diubah PIC event, admin, atau pemilik job yang diberi akses event.")
(define FINANCE-JOB    "Finance hanya dapat mengubah tagihan job.")
(define FINANCE-BUAT   "Finance tidak dapat membuat job.")
(define BUAT-SATU      "Anda belum diberi akses untuk membuat job di event ini. Minta PIC event memberi akses.")
(define BUAT-BANYAK    "Anda belum diberi akses untuk membuat job di event mana pun. Minta PIC event memberi akses.")
(define TANPA-EVENT    "Belum ada event yang dapat dipilih untuk job baru.")

;; Job di IIMS 2026 (field lain diabaikan): event-id "e-iims"
;;   JOB-BUDI : S.01, TPPB (BC 2.3), INBOUND, created-by "u-budi"
;;   JOB-RINA : A.01, TPPB (BC 2.3), INBOUND, created-by "u-rina"
;;   JOB-YUDI : R.01, Road Shipment, tanpa stage, created-by "u-yudi"
;;   JOB-LAMA : S.02, TPPB (BC 2.3), INBOUND, created-by #false
```

### Fungsi murni UI (`lib/write-access.ts`, BARU)

Mengimpor `canWriteJobInEvent`, `canManageEvent`, `creatableJenisInEvent`, `relationIn`,
`jobWriteScope`, `jobWriteDenial`, dan tipe langsung dari `@/features/auth/write-scope` (semuanya
di-export Bima), mengikuti pola `lib/use-billing-access.ts` yang mengimpor
`@/features/auth/capabilities`. Dengan begitu tes tidak memuat `lib/data-client`. Tes ada di
`lib/write-access.test.ts` (BARU, ditambahkan ke `domain:test`). Konstanta teks alasan (`MEMUAT`,
`GAGAL-MUAT`, dst. di atas) di-export dari modul ini supaya tes memakai nilai yang sama.

```racket
;; job-write-denial-reason : WriteAccess JobWriteCapability Job -> Denial
;; purpose: #false bila pengguna login boleh melakukan `cap` pada `job`; bila tidak, alasan yang
;;   ditampilkan saat ia mencoba (fungsi puncak pola "tampil, jelaskan saat dicoba")
;; boleh
(check-expect (job-write-denial-reason WA-BUDI 'job:update JOB-RINA) #false)      ; PIC: semua job
(check-expect (job-write-denial-reason WA-RINA 'job:cancel JOB-RINA) #false)      ; penerima: miliknya
(check-expect (job-write-denial-reason WA-YUDI 'job:create JOB-YUDI) #false)
(check-expect (job-write-denial-reason WA-AYU 'job:update JOB-LAMA) #false)       ; admin
(check-expect (job-write-denial-reason WA-BUDI 'job:update JOB-LAMA) #false)      ; PIC, job lama
;; job milik orang lain (penerima akses)
(check-expect (job-write-denial-reason WA-RINA 'job:update JOB-BUDI) BUKAN-MILIK)
(check-expect (job-write-denial-reason WA-YUDI 'job:cancel JOB-RINA) BUKAN-MILIK)
;; job lama tanpa pemilik tercatat (penerima akses)
(check-expect (job-write-denial-reason WA-RINA 'job:update JOB-LAMA) TANPA-PEMILIK)
;; bekas penerima akses: job miliknya sendiri pun ditolak
(check-expect (job-write-denial-reason WA-RINA-DICABUT 'job:update JOB-RINA) AKSES-DICABUT)
;; tanpa kaitan dengan event
(check-expect (job-write-denial-reason WA-TONO 'job:update JOB-BUDI) TANPA-AKSES)
(check-expect (job-write-denial-reason WA-RINA-DICABUT 'job:update JOB-BUDI) TANPA-AKSES)
;; Finance (tagihan diputuskan terpisah oleh useCanEditBilling, lihat JobDetail)
(check-expect (job-write-denial-reason WA-FAJAR 'job:update JOB-BUDI) FINANCE-JOB)
;; hak belum siap
(check-expect (job-write-denial-reason WA-LOADING 'job:update JOB-RINA) MEMUAT)
(check-expect (job-write-denial-reason WA-GAGAL 'job:update JOB-RINA) GAGAL-MUAT)
(define (job-write-denial-reason wa cap job)
  (cond [(wa-loading? wa) MEMUAT]
        [(wa-unavailable? wa) GAGAL-MUAT]
        [(wa-ready? wa)
         (local [(define a (wa-ready-actor wa))
                 (define rel (relation-in (my-write-access-events (wa-ready-access wa))
                                          (job-event-id job)))
                 (define owner (job-created-by-id job))]
           (cond [(can-write-job-in-event a cap rel owner) #false]
                 [else (denied-job-reason a (job-write-scope a cap rel) owner)]))]))
;; TS: jobWriteDenialReason(wa, capability, job): Denial; switch exhaustive pada wa.kind
```

```racket
;; denied-job-reason : Actor JobWriteScope [Maybe UserId] -> String
;; purpose: alasan, dalam bahasa pengguna, kenapa pengguna dengan cakupan `scope` ditolak menulis
;;   job milik `owner`. Hanya dipanggil bila ditolak. (non-export)
(check-expect (denied-job-reason FAJAR 'NONE "u-budi") FINANCE-JOB)
(check-expect (denied-job-reason RINA 'OWN "u-budi") BUKAN-MILIK)
(check-expect (denied-job-reason RINA 'OWN #false) TANPA-PEMILIK)
(check-expect (denied-job-reason RINA 'NONE "u-rina") AKSES-DICABUT)
(check-expect (denied-job-reason TONO 'NONE "u-budi") TANPA-AKSES)
(check-expect (denied-job-reason TONO 'NONE #false) TANPA-AKSES)
(check-expect (denied-job-reason BUDI 'ALL "u-budi")                 ; tidak pernah terjadi; total
              "Anda tidak memiliki izin untuk melakukan tindakan ini.")
(define (denied-job-reason a scope owner)
  (cond [(symbol=? (actor-role a) 'FINANCE) FINANCE-JOB]
        [(symbol=? scope 'OWN) (if (string? owner) (job-write-denial 'OWN) TANPA-PEMILIK)]
        [(symbol=? scope 'NONE)
         (if (and (string? owner) (string=? owner (actor-id a))) AKSES-DICABUT TANPA-AKSES)]
        [(symbol=? scope 'ALL) (job-write-denial 'ALL)]))
;; TS: switch exhaustive pada scope setelah cek FINANCE; peran tak dikenal (token lama) jatuh ke
;;   cabang 'NONE
```

```racket
;; job-permissions : WriteAccess Job -> JobPermissions
;; purpose: keputusan (dan alasan) tiap tombol tulis job untuk pengguna login
(check-expect (job-permissions WA-BUDI JOB-RINA) ALL-JOB-PERMISSIONS)
(check-expect (job-permissions WA-RINA JOB-RINA) ALL-JOB-PERMISSIONS)
(check-expect (job-permissions WA-RINA JOB-BUDI) (denied-all BUKAN-MILIK))
(check-expect (job-permissions WA-RINA JOB-LAMA) (denied-all TANPA-PEMILIK))
(check-expect (job-permissions WA-RINA-DICABUT JOB-RINA) (denied-all AKSES-DICABUT))
(check-expect (job-permissions WA-YUDI JOB-YUDI) ALL-JOB-PERMISSIONS)
(check-expect (job-permissions WA-YUDI JOB-RINA) (denied-all BUKAN-MILIK))
(check-expect (job-permissions WA-FAJAR JOB-BUDI) (denied-all FINANCE-JOB))
(check-expect (job-permissions WA-AYU JOB-LAMA) ALL-JOB-PERMISSIONS)
(check-expect (job-permissions WA-LOADING JOB-RINA) (denied-all MEMUAT))
(check-expect (job-permissions WA-GAGAL JOB-RINA) (denied-all GAGAL-MUAT))
(define (job-permissions wa job)
  (make-job-permissions (job-write-denial-reason wa 'job:update job)
                        (job-write-denial-reason wa 'job:cancel job)
                        (job-write-denial-reason wa 'job:create job)))
;; TS: jobPermissions(wa, job): JobPermissions
```

```racket
;; job-create-denial-reason : WriteAccess [List-of EventId] -> Denial
;; purpose: #false bila pengguna login boleh membuat job di minimal satu event `event-ids`; bila
;;   tidak, alasan untuk tombol New Job (detail event: satu event) atau Job baru (`/jobs`: semua
;;   event yang bisa dipilih)
(check-expect (job-create-denial-reason WA-YUDI (list "e-iims")) #false)
(check-expect (job-create-denial-reason WA-RINA (list "e-iims")) #false)
(check-expect (job-create-denial-reason WA-AYU (list "e-gjaw")) #false)
(check-expect (job-create-denial-reason WA-YUDI (list "e-gjaw" "e-iims")) #false)   ; /jobs
(check-expect (job-create-denial-reason WA-YUDI (list "e-gjaw")) BUAT-SATU)
(check-expect (job-create-denial-reason WA-RINA-DICABUT (list "e-iims")) BUAT-SATU)  ; bekas penerima
(check-expect (job-create-denial-reason WA-TONO (list "e-gjaw" "e-iims")) BUAT-BANYAK)
(check-expect (job-create-denial-reason WA-FAJAR (list "e-iims")) FINANCE-BUAT)
(check-expect (job-create-denial-reason WA-AYU '()) TANPA-EVENT)
(check-expect (job-create-denial-reason WA-LOADING (list "e-iims")) MEMUAT)
(check-expect (job-create-denial-reason WA-GAGAL (list "e-iims")) GAGAL-MUAT)
(define (job-create-denial-reason wa event-ids)
  (cond [(wa-loading? wa) MEMUAT]
        [(wa-unavailable? wa) GAGAL-MUAT]
        [(wa-ready? wa)
         (cond [(ormap (lambda (id) (cons? (creatable-jenis wa id))) event-ids) #false]
               [(symbol=? (actor-role (wa-ready-actor wa)) 'FINANCE) FINANCE-BUAT]
               [(empty? event-ids) TANPA-EVENT]
               [(empty? (rest event-ids)) BUAT-SATU]
               [else BUAT-BANYAK])]))
;; TS: jobCreateDenialReason(wa, eventIds: readonly string[]): Denial
;; Catatan: spesialis yang diberi akses selalu punya minimal satu jenis (invariant Data), jadi
;;   cabang BUAT-SATU/BUAT-BANYAK tidak salah menyebut "belum diberi akses" untuknya.
```

```racket
;; creatable-jenis : WriteAccess EventId -> [List-of JobJenis]
;; purpose: jenis job yang boleh dibuat pengguna login di event `event-id` (kosong = tidak boleh
;;   membuat job di sana)
(check-expect (creatable-jenis WA-YUDI "e-iims") (list 'ROAD_SHIPMENT))
(check-expect (creatable-jenis WA-YUDI "e-gjaw") '())
(check-expect (creatable-jenis WA-RINA "e-iims") JOB-JENIS)
(check-expect (creatable-jenis WA-BUDI "e-gjaw") '())
(check-expect (creatable-jenis WA-FAJAR "e-iims") '())
(check-expect (creatable-jenis WA-AYU "e-gjaw") JOB-JENIS)
(check-expect (creatable-jenis WA-LOADING "e-iims") '())
(define (creatable-jenis wa event-id)
  (cond [(wa-ready? wa)
         (local [(define acc (wa-ready-access wa))]
           (creatable-jenis-in-event (wa-ready-actor wa)
                                     (my-write-access-handled-job-jenis acc)
                                     (relation-in (my-write-access-events acc) event-id)))]
        [else '()]))
```

```racket
;; can-manage-event-access : WriteAccess [Maybe UserId] -> Boolean
;; purpose: apakah kartu "Akses event" boleh tampil untuk event ber-PIC `pic-id`
(check-expect (can-manage-event-access WA-BUDI "u-budi") #true)
(check-expect (can-manage-event-access WA-RINA "u-budi") #false)
(check-expect (can-manage-event-access WA-YUDI "u-budi") #false)
(check-expect (can-manage-event-access WA-AYU "u-budi") #true)
(check-expect (can-manage-event-access WA-AYU #false) #true)
(check-expect (can-manage-event-access WA-LOADING "u-budi") #false)
(define (can-manage-event-access wa pic-id)
  (cond [(wa-ready? wa) (can-manage-event (wa-ready-actor wa) 'event:access:manage pic-id)]
        [else #false]))
```

```racket
;; tab-action-denial : JobDetailTab JobPermissions Boolean -> Denial
;; purpose: keputusan tombol aksi di ujung tab detail job; argumen ketiga = boleh mengubah tagihan
;;   (useCanEditBilling). Tab Billing membuka dialog yang berisi Pihak dan/atau Tagihan, jadi Finance
;;   boleh membukanya walau tidak boleh mengubah job.
(check-expect (tab-action-denial 'muatan ALL-JOB-PERMISSIONS #false) #false)
(check-expect (tab-action-denial 'muatan (denied-all BUKAN-MILIK) #false) BUKAN-MILIK)
(check-expect (tab-action-denial 'transport (denied-all FINANCE-JOB) #true) FINANCE-JOB)
(check-expect (tab-action-denial 'billing (denied-all FINANCE-JOB) #true) #false)   ; Finance: tagihan
(check-expect (tab-action-denial 'billing (denied-all BUKAN-MILIK) #false) BUKAN-MILIK)
(check-expect (tab-action-denial 'billing ALL-JOB-PERMISSIONS #false) #false)       ; pemilik: pihak
(check-expect (tab-action-denial 'billing (denied-all MEMUAT) #true) #false)        ; billing? dari sesi
(define (tab-action-denial tab perms billing?)
  (cond [(and (symbol=? tab 'billing) billing?) #false]
        [else (job-permissions-update-denial perms)]))
;; TS: tabActionDenial(tab, perms, canEditBilling): Denial
```

Fungsi murni lain:

```racket
;; job-jenis-list-label : [List-of JobJenis] -> String
;; purpose: daftar jenis job yang dipegang, untuk tabel pengguna di Settings
;; file: lib/job-jenis.ts (memakai jobJenisLabel yang ada); tes: lib/job-jenis.test.ts BARU, masuk domain:test
(check-expect (job-jenis-list-label '()) "")
(check-expect (job-jenis-list-label (list 'ROAD_SHIPMENT)) "Road Shipment")
(check-expect (job-jenis-list-label (list 'ROAD_SHIPMENT 'PERMANENT_IMPORT))
              "Road Shipment, Permanent Import (Genco)")
(define (job-jenis-list-label jenis)
  (string-join (map job-jenis-label jenis) ", "))
```

```racket
;; unfilled-exhibitors-message : [List-of String] -> [Maybe String]
;; purpose: toast peringatan untuk exhibitor yang hall/booth-nya tidak dapat dilengkapi saat CIPL
;;   disimpan (jaring pengaman: gagal jaringan, validasi, atau akses dicabut di tengah proses);
;;   maksimal tiga nama disebut
;; file: domain/exhibition/cipl-autofill.ts (di samping summarizeAutofill); tes di
;;   domain/exhibition/cipl-autofill.test.ts yang sudah ada
;; (20 Nov: kalimat kedua lama "Exhibitor yang juga dipakai job lain hanya dapat diubah PIC event."
;;  dihapus bersama 'SHARED; diganti kalimat netral)
(check-expect (unfilled-exhibitors-message '()) #false)
(check-expect (unfilled-exhibitors-message (list "PT ACME"))
              "Hall/booth 1 exhibitor belum dilengkapi: PT ACME. CIPL sudah tersimpan; lengkapi hall/booth lewat Edit CIPL.")
(check-expect (unfilled-exhibitors-message (list "PT A" "PT B" "PT C"))
              "Hall/booth 3 exhibitor belum dilengkapi: PT A, PT B, PT C. CIPL sudah tersimpan; lengkapi hall/booth lewat Edit CIPL.")
(check-expect (unfilled-exhibitors-message (list "PT A" "PT B" "PT C" "PT D" "PT E"))
              "Hall/booth 5 exhibitor belum dilengkapi: PT A, PT B, PT C, dan 2 lainnya. CIPL sudah tersimpan; lengkapi hall/booth lewat Edit CIPL.")
(define (unfilled-exhibitors-message names)
  (cond [(empty? names) #false]
        [else
         (string-append "Hall/booth " (number->string (length names)) " exhibitor belum dilengkapi: "
                        (string-join (take-at-most names 3) ", ")
                        (if (> (length names) 3)
                            (string-append ", dan " (number->string (- (length names) 3)) " lainnya")
                            "")
                        ". CIPL sudah tersimpan; lengkapi hall/booth lewat Edit CIPL.")]))
```

### Hook `useWriteAccess` (`lib/use-write-access.ts`, BARU, `'use client'`)

```racket
;; use-write-access : -> [IO WriteAccess]
;; purpose: hak tulis pengguna login, dimuat sekali per mount halaman
;; state: wa : WriteAccess, initial
;;   (if (and sesi.user.id sesi.user.role) (make-wa-loading) (make-wa-unavailable))
;;   ; actor = { id, role, isAdmin } dari useSession().data.user
;; on mount (hanya bila wa = LOADING) : -> [IO WriteAccess]
;;   getMyWriteAccess()
;;     sukses -> (make-wa-ready actor access)
;;     gagal  -> (make-wa-unavailable)        ; TANPA toast (revisi 20 Nov): alasannya muncul
;;                                            ;   saat pengguna mencoba menulis (GAGAL-MUAT)
;;   ; abaikan hasil bila komponen sudah unmount (flag `active`, pola halaman job)
;; TS: export function useWriteAccess(): WriteAccess
```

Contoh: Rina membuka detail event → `LOADING` → `READY` (RINA, akses e-gjaw PIC, e-iims GRANTEE).
Sesi lama tanpa `role` → langsung `UNAVAILABLE`, tanpa fetch. Endpoint 503 → `UNAVAILABLE`, tanpa
toast; tombol tulis job tetap nonaktif, dan saat dicoba muncul toast "Hak ubah Anda tidak dapat
dimuat. Muat ulang halaman untuk mencoba lagi."

### Umpan balik penolakan (`components/guarded-button.tsx`, BARU, `'use client'`)

Satu mekanisme untuk semua tombol tulis job yang "tampil, jelaskan saat dicoba".

```racket
;; deny-write : String -> [IO Void]
;; purpose: tampilkan alasan penolakan sebagai toast 'error' kanan bawah; tidak memanggil server
;; TS: export function denyWrite(reason: string): void  — memanggil toast(reason, 'error') dari
;;   @/components/toast
(define (deny-write reason) (toast reason 'error))
;; contoh: (deny-write BUKAN-MILIK) -> satu toast merah "Penerima akses event hanya dapat mengubah
;;   job miliknya sendiri."; dipanggil dua kali cepat -> tetap satu toast (ToastViewport mengganti
;;   pesan identik dan mengulang timernya)
```

```racket
;; GuardedButton : (make-guarded-props Denial ButtonProps) -> View
;; purpose: tombol tulis yang selalu tampil; bila `denial` berisi alasan, tampil nonaktif dan
;;   menampilkan alasan saat dicoba, tanpa menjalankan aksinya
;; props: denial : Denial; sisanya props <button> biasa (type, class, aria-label, on-click,
;;   disabled, children). TS: ComponentPropsWithoutRef<'button'> & { denial: string | null }
(button
  type=(if (string? denial) "button" (or type "button"))     ; submit tidak terkirim bila ditolak
  aria-disabled=(if (string? denial) "true" absent)
  disabled=disabled                                         ; mis. sedang menyimpan; tidak berubah
  class=(string-append class " aria-disabled:cursor-not-allowed aria-disabled:opacity-50")
  on-click=handle-click
  children)
;; on (click e) : -> [IO Void]
;;   (cond [(string? denial) (begin (prevent-default e) (stop-propagation e) (deny-write denial))]
;;         [else (on-click e)])                              ; on-click boleh kosong (type submit)
;; Enter/Spasi pada button memicu click secara bawaan, jadi keyboard ikut jalur yang sama.
```

Contoh:
- `denial` = `#false`, `class "btn-primary"`, isi "New Job" → tombol oranye biasa; klik membuka
  wizard.
- `denial` = `BUAT-SATU` → tombol oranye pudar (50%), kursor dilarang; klik, sentuh, atau Enter →
  toast "Anda belum diberi akses untuk membuat job di event ini. Minta PIC event memberi akses.";
  wizard tidak terbuka.
- `denial` = `BUKAN-MILIK`, `type "submit"` (Simpan pabean) → form tidak terkirim; toast alasan.
- `denial` = `#false`, `disabled` = `#true` (sedang menyimpan) → perilaku `disabled` bawaan, tanpa
  toast.

`ActionMenu` (`components/action-menu.tsx`, BERUBAH) mendapat cara yang sama untuk butir menu:

```racket
;; ActionMenuItem BERUBAH: field opsional baru
;;   denied-reason : [Maybe String]   ; TS: deniedReason?: string
;; render butir dengan denied-reason:
(button role="menuitem" type="button" aria-disabled="true"
  class="... text-slate-500 hover:bg-slate-50 focus-visible:bg-slate-100 cursor-not-allowed"
  ;; warna danger (rose) TIDAK dipakai walau tone 'danger'
  (item-icon size=15 aria-hidden) (span.truncate label)
  (Lock size=13 aria-hidden class="ml-auto shrink-0 text-slate-400"))
;; on (select item) dengan denied-reason : (begin (close #true) (deny-write denied-reason))
;;   ; fokus kembali ke tombol ⋮, lalu toast; onSelect TIDAK dipanggil
;; Butir tetap ikut navigasi panah (selektor `:not(:disabled)` sudah memasukkannya, karena tidak
;;   memakai atribut disabled). Butir `disabled` lama ("Job sudah dibatalkan") tidak berubah.
```

Contoh: Rina membuka ⋮ di baris S.01 → "Edit" dan "Batalkan" abu-abu dengan ikon gembok kecil;
memilih "Batalkan" (klik atau Enter) → menu tertutup, fokus kembali ke ⋮, toast "Penerima akses
event hanya dapat mengubah job miliknya sendiri."; dialog batal tidak terbuka.

### Komponen puncak (contoh untuk persetujuan pengguna)

Ringkasan "yang dilihat dan dialami tiap orang". Rinciannya ada di komponen masing-masing di bawah.
"Nonaktif + alasan" = tombol tetap tampil pudar; saat diklik/disentuh/Enter muncul toast merah di
kanan bawah berisi alasan, dan tidak ada yang berubah.

| Layar | Ayu (admin) | Budi (PIC IIMS) | Rina (CS, akses IIMS) | Yudi (Spesialis Road, akses IIMS) | Fajar (Finance) |
|---|---|---|---|---|---|
| `/events`: tombol Event baru | ada | tidak tampil | tidak tampil | tidak tampil | tidak tampil |
| `/events`: menu ⋮ baris IIMS (Edit, Arsipkan, Hapus) | ada | ada | tidak tampil | tidak tampil | tidak tampil |
| Detail IIMS: New Job | aktif, 6 jenis | aktif, 6 jenis | aktif, 6 jenis | aktif, hanya Road Shipment | nonaktif + "Finance tidak dapat membuat job." |
| Detail GJAW (PIC Rina): New Job | aktif | nonaktif + "Anda belum diberi akses untuk membuat job di event ini. Minta PIC event memberi akses." | aktif | nonaktif + alasan yang sama | nonaktif + "Finance tidak dapat membuat job." |
| Detail IIMS: Edit/Batalkan di menu ⋮ baris job | aktif di semua job | aktif di semua job | aktif di job Rina; job lain nonaktif + "Penerima akses event hanya dapat mengubah job miliknya sendiri." | aktif di job Yudi; job lain nonaktif + alasan yang sama | nonaktif + "Finance hanya dapat mengubah tagihan job." |
| Detail IIMS: kartu Akses event | ada | ada | tidak tampil | tidak tampil | tidak tampil |
| `/jobs`: Job baru | aktif (semua event) | aktif (event yang ia PIC-i) | aktif (GJAW, IIMS) | aktif (hanya IIMS) | nonaktif + "Finance tidak dapat membuat job." |
| Detail job S.01 milik Budi | semua aktif | semua aktif | semua tombol ubah nonaktif + "Penerima akses event hanya dapat mengubah job miliknya sendiri." | sama seperti Rina | tombol ubah job nonaktif + "Finance hanya dapat mengubah tagihan job."; tombol Billing dan "Ubah" Tagihan aktif |
| Detail job R.01 milik Yudi | semua aktif | semua aktif | nonaktif + alasan "hanya job miliknya" | semua aktif | seperti S.01 |
| Detail job S.02 (job lama, tanpa pemilik tercatat) | semua aktif | semua aktif | nonaktif + "Job ini belum punya pemilik tercatat, jadi hanya dapat diubah PIC event atau admin." | sama seperti Rina | seperti S.01 |
| Detail job A.01 milik Rina, setelah akses Rina ke IIMS dicabut | semua aktif | semua aktif | nonaktif + "Anda tidak lagi memiliki akses ke event ini. Minta PIC event memberi akses agar dapat mengubah job ini." | nonaktif + alasan "hanya job miliknya" | seperti S.01 |
| Halaman baru dibuka, hak masih dimuat (sekejap) | tombol ubah pudar sebentar; bila dicoba: "Hak ubah Anda masih dimuat. Coba lagi sebentar." | sama | sama | sama | sama |
| Hak gagal dimuat (jaringan/server) | tombol ubah tetap pudar; bila dicoba: "Hak ubah Anda tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi." | sama | sama | sama | sama |
| Settings → Pengguna | pilih peran CS/Spesialis/Finance; Spesialis wajib pilih jenis | (tidak tampil, non-admin) | – | – | – |
| Simpan scan CIPL di job Rina, exhibitor ACME juga dipakai job Budi | CIPL tersimpan, hall/booth terisi | sama | CIPL tersimpan, hall/booth ACME terisi (juga terlihat di job Budi) | – | – |

Tidak ada lagi catatan "Anda hanya dapat melihat job ini…" di mana pun. Job batal tetap seperti
sekarang: tombol ubah hilang dan banner "Job dibatalkan… Job ini tidak dapat diubah lagi."

#### `EventsPage` (Server Component, BERUBAH) — `app/(dashboard)/events/page.tsx`

```racket
;; EventsPage : SearchParams -> [IO View]
;; purpose: daftar event; tombol Event baru hanya untuk yang boleh membuat event
;; tambahan (setelah requireCurrentUser):
;;   (define can-create-event (is-role-sufficient current-user 'event:create))
;;   ; import { isRoleSufficient } from '@/features/auth/write-scope'
(div.flex.flex-col.gap-4 ...
  (h1.sr-only "Events")
  (section ...
    (EventFilters pics result-count
      (div.flex.items-center.gap-3
        (EventExportButton)
        (when can-create-event (EventCreateButton venues organizers pics))))
    (cond [(false? page) (ErrorCard ...)]                          ; tidak berubah
          [else (EventList items venues organizers pics #:actor current-user)])))
```

Contoh:
- Ayu → [Export] [+ Event baru].
- Budi, Rina, Yudi, Fajar → [Export] saja. Tidak ada placeholder; tombol Export tetap di kanan.

#### `EventList` (Server Component, BERUBAH) — `features/events/components/event-list.tsx`

```racket
;; EventList : (make-event-list-props [List-of EventListItem] Options Actor) -> View
;; purpose: baris event; menu aksi per baris hanya bila pengguna pengelola event itu
;; props baru: actor : Actor   ; CurrentUser server
;; per item:
;;   (define can-update (can-manage-event actor 'event:update (item-pic-id item)))
;;   (define can-delete (can-manage-event actor 'event:delete (item-pic-id item)))
;;   ; import { canManageEvent } from '@/features/auth/write-scope'
(td.sticky.right-0 ... data-row-click-ignore
  (when (or can-update can-delete)
    (EventCardActions event lifecycle venues organizers pics can-update can-delete)))
;; sel tetap dirender (struktur tabel), isinya kosong bila tidak boleh
```

Contoh:
- Budi: baris IIMS (PIC u-budi) → ⋮. Baris GJAW (PIC u-rina) → sel kosong.
- Rina: baris IIMS → kosong. Baris GJAW → ⋮.
- Ayu: semua baris ⋮, termasuk event tanpa PIC.
- Yudi, Fajar: semua sel kosong.
- Daftar kosong: tidak berubah ("Belum ada event yang sesuai").

#### `EventCardActions` (`'use client'`, BERUBAH) — `features/events/components/event-card-actions.tsx`

```racket
;; EventCardActions : EventCardActionsProps -> View
;; props baru: can-update : Boolean, can-delete : Boolean
;; invariant: (or can-update can-delete), dijaga pemanggil
(Menu.Root
  (Menu.Trigger aria-label="Menu aksi untuk {name}" ...)               ; tidak berubah
  (Menu.Popup
    (when can-update (Menu.Item "Edit"))                               ; Edit = juga surat penunjukan
    (when (and can-update (not (eq? lifecycle 'ARCHIVED))) (Menu.Item "Arsipkan"))
    (when can-delete (Menu.Item.text-rose-700 "Hapus"))))
;; state dan event (edit, arsip, hapus) TIDAK berubah; semuanya sudah menoast sukses/gagal
;;   termasuk pesan 403 server ("Hanya PIC event atau admin yang dapat melakukan tindakan ini.")
```

Contoh: Budi pada IIMS aktif → Edit, Arsipkan, Hapus. Budi pada IIMS yang sudah diarsip → Edit,
Hapus.

`EventCreateButton` dan `EventFormModal`: **tidak berubah** (lihat Temuan).

#### `EventDetailPage` (`'use client'`, BERUBAH) — `app/(dashboard)/events/[id]/page.tsx`

```racket
;; EventDetailPage : {id : EventId} -> View
;; purpose: detail event dan job-nya; tombol tulis job tampil untuk semua dan menjelaskan saat
;;   ditolak; kartu Akses event hanya untuk pengelola
;; state tambahan: wa : WriteAccess, dari (use-write-access)
;; turunan (setelah event termuat):
;;   (define jenis-baru (creatable-jenis wa (event-id event)))
;;   (define new-job-denial (job-create-denial-reason wa (list (event-id event))))
;;   (define can-manage-access (can-manage-event-access wa (event-pic-id event)))
(div.-mt-3.space-y-4
  (header ...)                                       ; tidak berubah (Export manifest = baca)
  (section.card "Informasi event" ...)               ; tidak berubah
  (section.space-y-4
    (h2 "Detail Jobs")
    (div ... (Tabs ...)
         (when (not (eq? (event-status event) 'CANCELLED))          ; syarat lama, tetap
           (GuardedButton #:denial new-job-denial class="btn-primary shrink-0"
                          #:on-click (lambda () (set! show-new-job #true))
             (Plus size=16 aria-hidden) "New Job")))
    ... (JobRow job actions #:permissions (job-permissions wa job)) ...)    ; actions tidak berubah
  (when can-manage-access (EventAccessCard (event-id event)))      ; BARU dipasang (disetujui 20 Nov)
  (when cancelling-job (CancelJobDialog ...))                        ; tidak berubah
  (when letter-job (KanwilLetterDialog ...))                         ; tidak berubah
  (when (and show-new-job (false? new-job-denial))
    (JobCreateWizard #:events (list event) #:preset-event event
                     #:jenis-for (lambda (id) jenis-baru) ...)))
;; on (load ?newJob=1) : tidak berubah (show-new-job := #true). Wizard baru terbuka setelah
;;   new-job-denial = #false; bila hak siap dan tetap ditolak, parameter diabaikan tanpa pesan
;;   (pengguna belum menekan apa pun di halaman ini).
```

Contoh (IIMS 2026, job: JOB-BUDI, JOB-RINA, JOB-YUDI, JOB-LAMA):
- Budi:
  - New Job aktif; wizard menawarkan 6 jenis;
  - setiap baris: ⋮ berisi Edit, (Surat Kanwil, Form rincian bila berlaku), Batalkan, semua aktif;
  - kartu "Akses event" tampil di bawah daftar job.
- Rina:
  - New Job aktif, 6 jenis;
  - baris A.01 (miliknya): Edit dan Batalkan aktif;
  - baris S.01, R.01: ⋮ berisi Edit dan Batalkan nonaktif (gembok), plus Surat Kanwil dan Form
    rincian aktif bila berlaku (unduhan, bukan tulis). Memilih Edit/Batalkan → toast "Penerima
    akses event hanya dapat mengubah job miliknya sendiri.";
  - baris S.02 (job lama): Edit/Batalkan nonaktif; dicoba → "Job ini belum punya pemilik
    tercatat, jadi hanya dapat diubah PIC event atau admin.";
  - tanpa kartu akses.
- Yudi: New Job aktif, wizard hanya "Road Shipment". Baris R.01: Edit dan Batalkan aktif. Baris lain:
  nonaktif + alasan seperti Rina. Tanpa kartu akses.
- Fajar: New Job nonaktif; dicoba → "Finance tidak dapat membuat job."; Edit/Batalkan di semua
  baris nonaktif; dicoba → "Finance hanya dapat mengubah tagihan job."; tanpa kartu akses.
- Tono (CS tanpa kaitan) di IIMS: New Job nonaktif; dicoba → "Anda belum diberi akses untuk
  membuat job di event ini. Minta PIC event memberi akses."; Edit/Batalkan di baris → "Job ini
  hanya dapat diubah PIC event, admin, atau pemilik job yang diberi akses event."
- Ayu: seperti Budi.
- `wa` = LOADING: halaman dan daftar job tampil; New Job dan Edit/Batalkan sudah tampil pudar;
  dicoba → "Hak ubah Anda masih dimuat. Coba lagi sebentar."; kartu akses belum dirender. Setelah
  siap, tombol aktif sesuai hak.
- `wa` = UNAVAILABLE: seperti LOADING, tetapi alasannya "Hak ubah Anda tidak dapat dimuat. Muat
  ulang halaman untuk mencoba lagi."; kartu akses tidak dirender.
- Event dibatalkan: New Job tidak tampil untuk siapa pun (seperti sekarang).
- Belum ada job: pesan "Belum ada job untuk event ini." tetap tampil. New Job tampil sesuai aturan
  di atas.

#### `JobsPage` (`'use client'`, BERUBAH) — `app/(dashboard)/jobs/page.tsx`

```racket
;; JobsPage : -> View
;; purpose: daftar semua job; tombol Job baru selalu tampil, aktif bila ada event tempat pengguna
;;   boleh membuat job, dan menjelaskan saat ditolak
;; state tambahan: wa : WriteAccess, dari (use-write-access)
;; turunan:
;;   (define creatable-events (filter (lambda (e) (cons? (creatable-jenis wa (event-id e)))) events))
;;   (define new-job-denial (job-create-denial-reason wa (map event-id events)))
;; Tombol Job baru (dua tempat, sama):
;;   (Button type="button" aria-disabled=(if (string? new-job-denial) "true" absent)
;;           class="<kelas lama> aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
;;           on-click=(lambda () (if (string? new-job-denial)
;;                                   (deny-write new-job-denial)
;;                                   (set! show-new-job #true)))
;;     (Plus data-icon="inline-start") "Job baru")
;;   ; Button (components/ui) dipakai karena tombol ini sudah memakainya; logikanya sama dengan
;;   ;   GuardedButton
(div.space-y-4
  (section "Filter job" ... (JobBaruButton))                          ; selalu tampil
  (cond [(cons? rows) (JobTable ...)]                                ; JobTable TIDAK berubah (menu = unduh BC)
        [else (EmptyState
                (p (if (cons? jobs) "Tidak ada job yang sesuai" "Belum ada job"))
                (p (if (cons? jobs)
                       "Ubah pencarian atau filter untuk melihat job lain."
                       "Buat job pertama untuk mulai mengelola kiriman."))   ; tidak berubah
                (if (cons? jobs) (button "Reset filter") (JobBaruButton)))])
  (when show-new-job (NewJobDialog ...))                             ; tidak berubah
  (when wizard-open
    (JobCreateWizard #:events creatable-events #:preset-event #false
                     #:jenis-for (lambda (id) (creatable-jenis wa id)) ...)))
;; "JobBaruButton" di atas hanya nama untuk dua salinan tombol yang sama di halaman ini, bukan
;;   komponen baru.
```

Contoh:
- Ayu → Job baru aktif; event di wizard: semua event.
- Budi → aktif; event di wizard: yang ia PIC-i (IIMS).
- Rina → aktif; GJAW dan IIMS.
- Yudi → aktif; hanya IIMS; setelah IIMS dipilih, jenis hanya Road Shipment.
- Fajar → Job baru nonaktif; dicoba → "Finance tidak dapat membuat job."; NewJobDialog tidak
  terbuka.
- Tono (CS tanpa kaitan) → nonaktif; dicoba → "Anda belum diberi akses untuk membuat job di event
  mana pun. Minta PIC event memberi akses."
- Belum ada event sama sekali (Ayu) → nonaktif; dicoba → "Belum ada event yang dapat dipilih
  untuk job baru."
- `wa` = LOADING / UNAVAILABLE → nonaktif dengan alasan `MEMUAT` / `GAGAL-MUAT`.

#### `JobDetail` (`'use client'`, BERUBAH) — `app/(dashboard)/jobs/[id]/page.tsx`

```racket
;; JobDetail : {id : JobId} -> View
;; purpose: detail job; semua tombol tulis job tampil, aktif bila boleh, dan menjelaskan alasannya
;;   saat dicoba bila tidak boleh
;; state tambahan: wa : WriteAccess, dari (use-write-access)
;; turunan (setelah job termuat):
;;   (define perms (job-permissions wa job))
;;   (define update-denial (job-permissions-update-denial perms))
;;   (define billing? (use-can-edit-billing))                 ; hook yang ada
;;   (define tab-denial (tab-action-denial tab perms billing?))
;;   show-tab-action TIDAK berubah (syarat lama: tidak batal, bukan tab pabean, dst.);
;;     tombolnya kini GuardedButton dengan tab-denial
;;   job-menu-items BERUBAH: item 'cancel mendapat deniedReason (job-permissions-cancel-denial perms)
;;     (#false -> tanpa field). Item 'workbook dan item nonaktif "Job sudah dibatalkan" tidak berubah.
(div.space-y-6
  (header ...
    (div.flex.items-center.gap-2
      (when (not cancelled)                                       ; syarat lama, tetap
        (GuardedButton #:denial update-denial #:on-click open-header
                       class="<kelas lama tombol Ubah header>"
          (Pencil size=14 aria-hidden) "Ubah header"))
      (ActionMenu "Menu aksi job" job-menu-items)))
  ;; TIDAK ada catatan baca-saja (dihapus, revisi 20 Nov)
  (JobDeadlineBanner ...)                                         ; tidak berubah
  (when cancelled (CancelledBanner ...))                          ; tidak berubah
  (div.grid... (JobReadinessBar ...) (JobNotesPanel job on-saved #:denial update-denial))
  (when (job-stage job)
    (JobStageCard ... #:create-denial (job-permissions-create-stage-denial perms)))
  (Tabs ...
    (when show-tab-action
      (GuardedButton #:denial tab-denial #:on-click open-tab-editor class="<kelas lama>"
        (Pencil size=14 aria-hidden) tab-action-text))
    (TabsContent "pabean" (JobCustomsCard job source on-saved #:denial update-denial) ...)
    (TabsContent "billing" (JobPartyInvoiceCard job exhibitors on-saved #:party-denial update-denial)))
  (CiplEntryModal ...) (JobDocumentEditorDialog ...)               ; tidak berubah; hanya terbuka lewat pemicu yang lolos
  (JobBillingDialog ... #:can-edit-party (false? update-denial))
  (JobHeaderDialog ...) (CancelJobDialog ...))
;; on (navigate-readiness 'header) :
;;   (cond [cancelled (void)]                                     ; seperti sekarang
;;         [(string? update-denial) (deny-write update-denial)]   ; langkah "No Job" = mencoba mengubah
;;         [else (set! header-open #true)])
;; on (navigate-readiness tab) : tidak berubah (navigasi tab tetap untuk semua)
```

Contoh:
- Rina membuka A.01 (miliknya, aktif): tampil dan berfungsi seperti sekarang; tidak ada tombol
  pudar.
- Rina membuka S.01 (milik Budi):
  - header: "Ubah header" pudar; ⋮ berisi "Export workbook BC 2.3" (aktif) dan "Batalkan job"
    (abu-abu, gembok);
  - tidak ada catatan apa pun di bawah header;
  - menekan "Ubah header", "Batalkan job", "Edit CIPL"/"Edit B/L-AWB"/tombol Billing, pensil
    catatan, "Tambah catatan", "Buat job BC 2.5", "Ubah" Pihak, atau Simpan di tab Pabean → satu
    toast merah "Penerima akses event hanya dapat mengubah job miliknya sendiri."; tidak ada
    dialog atau mode ubah yang terbuka;
  - tab Pabean: field tetap nonaktif sebagai tampilan baca; Simpan tampil pudar;
  - langkah "No Job" di bar kesiapan → toast alasan yang sama.
- Fajar membuka S.01:
  - tombol ubah job pudar; dicoba → "Finance hanya dapat mengubah tagihan job.";
  - tab Billing: tombol aksi aktif; dialognya hanya berisi bagian Tagihan;
  - kartu Tagihan: "Ubah" aktif; kartu Pihak: "Ubah" pudar.
- Yudi membuka R.01 (miliknya): semua aktif. Yudi membuka A.01: pudar + "Penerima akses event
  hanya dapat mengubah job miliknya sendiri."
- Budi membuka S.02 (job lama tanpa pemilik): semua aktif. Rina membuka S.02: pudar + "Job ini
  belum punya pemilik tercatat, jadi hanya dapat diubah PIC event atau admin."
- Rina membuka A.01 setelah aksesnya ke IIMS dicabut: pudar + "Anda tidak lagi memiliki akses ke
  event ini. Minta PIC event memberi akses agar dapat mengubah job ini."
- Job batal: seperti sekarang (banner "Job dibatalkan…", tombol ubah hilang).
- `wa` = LOADING: tombol tulis pudar sekejap; dicoba → "Hak ubah Anda masih dimuat. Coba lagi
  sebentar."; aktif setelah siap. Tombol Billing untuk Fajar sudah aktif sejak awal (hak tagihan
  dari sesi, bukan dari `wa`).
- `wa` = UNAVAILABLE: tombol tulis tetap pudar; dicoba → "Hak ubah Anda tidak dapat dimuat. Muat
  ulang halaman untuk mencoba lagi."
- Server menolak walau UI mengizinkan (mis. akses Rina dicabut saat halaman terbuka, lalu ia
  menyimpan catatan): toast gagal berisi pesan 403 server ("Penerima akses event hanya dapat
  mengubah job miliknya sendiri." atau "Anda tidak memiliki izin untuk melakukan tindakan ini.").
  Isian tetap di form.

#### `SettingsManager` → bagian Pengguna (`'use client'`, BERUBAH) — `app/(dashboard)/settings/settings-manager.tsx`

Hanya admin yang melihat bagian ini (tidak berubah).

```racket
;; SettingsManager : {current-user-id : UserId} -> View
;; purpose: kelola pengguna, venue, EO; peran CS/Spesialis/Finance dan jenis job spesialis
;; state tambahan (hanya dipakai editor 'users):
;;   role-draft  : Role,               initial 'CS
;;   jenis-draft : [List-of JobJenis], initial '()
;;   jenis-error : [Maybe String],     initial #false
```

Tabel pengguna, kolom Peran:

```racket
(td.px-5.py-4
  (span.text-slate-600 (ROLE_LABELS (user-role u)))
  (when (cons? (user-handled-job-jenis u))
    (span.block.text-xs.text-slate-500 (job-jenis-list-label (user-handled-job-jenis u)))))
```

Editor pengguna (di dalam form yang ada, menggantikan `<label>Peran<select …>`):

```racket
(div
  (label.label "Peran"
    (select name="role" required value=role-draft class="input" aria-describedby="role-help"
      (map (lambda (r) (option r (ROLE_LABELS r))) ROLES)))     ; ROLES = CS, SPESIALIS, FINANCE
  (p#role-help.mt-1.text-xs.text-slate-500
     "CS dapat menjadi PIC event. Spesialis membuat dan mengurus job sesuai jenis yang dipegang, di event yang ia diberi akses. Finance mengurus tagihan."))
(when (eq? role-draft 'SPESIALIS)
  (fieldset.rounded-xl.border.border-black/10.p-4
     aria-describedby=(when jenis-error "handled-jenis-error")
    (legend.px-1.text-sm.font-semibold "Jenis job yang dipegang "
      (span.font-normal.text-slate-500 "(wajib, minimal satu)"))
    (div.mt-2.grid.gap-1.sm:grid-cols-2
      (map (lambda (j)
             (label.flex.min-h-11.items-center.gap-3.rounded-lg.px-2.text-sm.hover:bg-slate-50
               (input type="checkbox" class="h-4 w-4 accent-orange-600"
                      checked=(member? j jenis-draft))
               (job-jenis-label j)))
           JOB-JENIS))                                       ; jobJenisValues, enam termasuk Local
    (when jenis-error
      (p#handled-jenis-error.mt-2.text-sm.text-rose-700 role="alert" jenis-error))))
(label.flex.items-center.gap-3 "Akses admin" ...)            ; tidak berubah
```

```racket
;; on (open-editor 'users #false) : role-draft := 'CS, jenis-draft := '(), jenis-error := #false
;; on (open-editor 'users user)   : role-draft := (user-role user),
;;                                   jenis-draft := (user-handled-job-jenis user), jenis-error := #false
;; on (change-role r)             : role-draft := r; jenis-error := #false
;;                                   (jenis-draft disimpan; tidak dikirim bila r bukan SPESIALIS)
;; on (toggle-jenis j)            : jenis-draft := jenis-draft dengan j ditambah/dibuang, urut JOB-JENIS;
;;                                   jenis-error := #false bila hasilnya tidak kosong
;; on (submit) untuk 'users : -> [IO ...]
;;   (define handled (if (eq? role-draft 'SPESIALIS) jenis-draft '()))
;;   (define err (handled-jenis-error role-draft handled))     ; import dari @/domain/user/validation
;;   (cond [err  jenis-error := err; fokus ke checkbox pertama; TANPA toast; tidak memanggil server]
;;         [else input := {...input lama, role: role-draft, handledJobJenis: handled}
;;               lalu create/updateSettingsRecord seperti sekarang:
;;               sukses -> toast 'success' "User berhasil ditambahkan." / "User berhasil diperbarui."
;;               gagal  -> error form (yang ada) + toast 'error' pesan server])
```

Contoh:
- Admin menambah Yudi:
  - pilih "Spesialis" → kotak "Jenis job yang dipegang" muncul dengan enam pilihan;
  - centang "Road Shipment" → Simpan → toast "User berhasil ditambahkan.";
  - tabel menampilkan "Spesialis" dengan "Road Shipment" di bawahnya.
- Spesialis tanpa jenis → Simpan → di bawah kotak: "Spesialis wajib memegang minimal satu jenis
  job." Tidak ada toast; form tidak terkirim.
- Mengubah Yudi menjadi "CS": kotak jenis hilang; tersimpan dengan jenis kosong; tabel hanya "CS (PIC
  event)".
- Fajar: "Finance", tanpa baris jenis.
- Spesialis memegang Local dan Road Shipment: baris kedua "Road Shipment, Local", urut sesuai
  `JOB-JENIS`.
- Server menolak (mis. mengubah Budi yang PIC event menjadi Spesialis): error form + toast gagal
  dengan pesan server.

#### Alur simpan CIPL dan exhibitor

`CiplEntryModal` (`'use client'`, BERUBAH sedikit) — `components/cipl-entry-modal.tsx`. Pemanggilan
`applyCiplAutofill` tidak berubah; urutan barunya ada di data-client (Bima). Setelah toast ringkasan
dan toast `unlinked` yang ada:

```racket
;; sesudah (when (cons? (outcome-unlinked autofill)) ...) :
(define pesan (unfilled-exhibitors-message (outcome-unfilled-exhibitors autofill)))
(when pesan (toast pesan 'error))
;; Toast ringkasan "CIPL disimpan · …" tetap 'success' (CIPL memang tersimpan); `failures` tidak
;; bertambah karena exhibitor yang gagal dilengkapi.
```

Contoh:
- Rina menyimpan scan CIPL untuk A.01. ACME (sudah ada, hall kosong) juga tercantum di S.01 milik
  Budi → sejak 20 Nov ini **sukses**: `unfilledExhibitors = ()`, hall/booth ACME terisi (dan ikut
  terlihat di S.01, efek yang diterima sampai fase 2). Hanya satu toast:
  - "CIPL disimpan · 2 exhibitor CIPL (1 tertaut, 1 exhibitor baru) · 14 baris barang." (sukses).
- Budi menyimpan scan yang sama di S.01 → sama, hall/booth ACME terisi, satu toast sukses.
- Jaringan putus saat melengkapi hall/booth ACME (CIPL sudah tersimpan) →
  `unfilledExhibitors = ("ACME")`. Dua toast:
  - toast ringkasan "CIPL disimpan · …" (sukses);
  - "Hall/booth 1 exhibitor belum dilengkapi: ACME. CIPL sudah tersimpan; lengkapi hall/booth
    lewat Edit CIPL." (gagal).
- Pembuatan exhibitor baru ditolak server (mis. akses Rina dicabut saat modal terbuka) → seluruh
  simpan gagal, toast gagal berisi pesan server ("Penerima akses event hanya dapat mengubah job
  miliknya sendiri."), modal tetap terbuka (perilaku `catch` yang ada).
- Modal ini hanya bisa dibuka lewat tombol "Buat CIPL"/"Edit CIPL" yang lolos `tab-action-denial`;
  pengguna yang ditolak tidak pernah sampai ke sini (alasan sudah tampil saat ia menekan tombol).

`CiplLineModal` (`'use client'`, BERUBAH) — `components/cipl-line-modal.tsx`. Tampilan tidak
berubah. Hanya `submit` yang diubah:

```racket
;; on (submit) : -> [IO Job]
;;  1. (define-values (koli notes) (build-line))                ; galat -> error + toast, berhenti (seperti sekarang)
;;  2. exhibitor-id :=
;;       (cond [(string=? choice NEW)
;;              (exhibitor-id (first (create-event-exhibitors (job-event-id job)
;;                                     (list {name, kind, hall, booth}) (job-id job))))]
;;             [else (or choice #false)])
;;     gagal -> error + toast gagal pesan server, berhenti (CIPL belum disimpan)
;;  3. saved := (save-job-cipl job (job-cipl-document job) lines-dengan-baris-ini)
;;     gagal -> error + toast gagal pesan server, berhenti
;;  4. (when (and chosen (or (/= (exhibitor-hall chosen) hall) (/= (exhibitor-booth chosen) booth)))
;;       (update-exhibitor (exhibitor-id chosen) {hall, booth} (job-id job)))
;;     sukses / tidak perlu -> toast 'success' "Baris CIPL {nama} tersimpan."
;;     gagal                -> toast 'error' "Baris CIPL {nama} tersimpan, tetapi hall/booth exhibitor tidak diubah: {pesan server}"
;;                             ; pola EventFormModal "…, tetapi surat penunjukan gagal disimpan: …"
;;  5. (on-saved saved)   ; langkah 4 sukses atau gagal: CIPL sudah tersimpan, modal ditutup
```

Contoh:
- Rina menautkan baris "ACME" ke exhibitor ACME (belum tercantum di A.01) dan mengisi hall B1:
  - langkah 3 menautkan ACME ke A.01, langkah 4 lolos (exhibitor kini tercantum di job Rina);
  - toast "Baris CIPL ACME tersimpan."
- Sama, tetapi ACME juga dipakai S.01 milik Budi → sejak 20 Nov tetap **sukses**: langkah 4
  lolos, hall B1 tersimpan di ACME (ikut terlihat di S.01), toast "Baris CIPL ACME tersimpan."
- Langkah 4 ditolak server karena akses Rina ke IIMS dicabut setelah langkah 3 → toast gagal
  "Baris CIPL ACME tersimpan, tetapi hall/booth exhibitor tidak diubah: Penerima akses event hanya
  dapat mengubah job miliknya sendiri."
- Langkah 4 ditolak karena exhibitor tidak tercantum di job (mis. baris tertaut ke exhibitor lain
  di langkah 3 karena data berubah bersamaan) → toast gagal "Baris CIPL ACME tersimpan, tetapi
  hall/booth exhibitor tidak diubah: Exhibitor ini tidak tercantum di job tersebut. Simpan CIPL job
  dulu, lalu ubah exhibitor."
- "+ Daftarkan baru: PT BARU" → exhibitor dibuat lewat A.01, baris tersimpan, toast sukses.
- Pemicu modal ini (bila kelak dipasang) wajib `GuardedButton` dengan `update-denial`.

### Sub-komponen (wishlist yang sudah didesain)

```racket
;; JobRow : (make-job-row-props Job [Maybe EventRef] [Maybe JobRowActions] JobPermissions) -> View
;; file: components/job-row.tsx ('use client', BERUBAH)
;; props baru: permissions : JobPermissions, default (denied-all MEMUAT)
;;   ; default aman: tanpa props, Edit/Batalkan nonaktif dengan alasan "masih dimuat"
;; items ActionMenu (urutan dan syarat tampil TIDAK berubah; hanya ditambah deniedReason):
;;   (append (list (Edit #:denied-reason (job-permissions-update-denial p)))
;;           (if <syarat Kanwil lama> (list Kanwil Tppb) '())          ; unduhan, selalu aktif
;;           (if (not (eq? status 'CANCELLED))
;;               (list (Batalkan #:denied-reason (job-permissions-cancel-denial p)))
;;               '()))
;; denied-reason #false -> butir tanpa field (aktif, seperti sekarang)
```

Contoh:
- R.01 (Road, INTERNATIONAL, bukan turunan) untuk Rina → [Edit (gembok), Surat Kanwil, Form
  rincian, Batalkan (gembok)]; memilih Edit → toast "Penerima akses event hanya dapat mengubah job
  miliknya sendiri.", tidak pindah halaman.
- A.01 untuk Rina → [Edit, Surat Kanwil, Form rincian, Batalkan], semua aktif.
- Job Local milik Budi dilihat Rina → [Edit (gembok), Batalkan (gembok)]; tombol ⋮ tetap tampil.
- Job batal milik siapa pun → [Edit] saja (Batalkan tidak tampil, seperti sekarang); Edit
  mengikuti `update-denial`.

```racket
;; JobCreateWizard : WizardProps -> View
;; file: components/job-create-wizard.tsx ('use client', BERUBAH)
;; props: events : [List-of LocalEvent], preset-event : [Maybe LocalEvent],
;;        jenis-for : EventId -> [List-of JobJenis]   ; BARU
;;        on-created, on-cancel                       ; tidak berubah
;; invariant: setiap event di `events` (dan preset-event) punya (jenis-for id) tidak kosong
;; tipe JobTypeSelection diganti JobJenis; jobTypeLabel diganti jobJenisLabel
;; state BERUBAH:
;;   selection      : [Maybe JobJenis], initial (if preset-event (first (jenis-for preset-id)) #false)
;;   transport-mode : initial (if (eq? selection 'ROAD_SHIPMENT) 'ROAD 'SEA)
;;   tanpa-agent    : initial (eq? selection 'LOCAL)
;; turunan: jenis-options = (if selected-event (jenis-for (event-id selected-event)) '())
(label.label "Jenis job"
  (select.input.mt-1 value=(or selection "") disabled=(empty? jenis-options)
          aria-describedby=(when (help?) "job-jenis-help")
    (if (empty? jenis-options)
        (option "" "Pilih event dulu")
        (map (lambda (j) (option j (job-jenis-label j))) jenis-options)))
  (when (and (cons? jenis-options) (< (length jenis-options) (length JOB-JENIS)))
    (span#job-jenis-help.mt-1.block.text-xs.font-normal.text-slate-500
      "Pilihan sesuai jenis job yang Anda pegang.")))
;; on (select-event e) : selected-event-id := (event-id e); event-query := nama;
;;   (local [(define opts (jenis-for (event-id e)))]
;;     (unless (member? selection opts) (change-selection (first opts))))   ; change-selection yang ada
;; on (type-event-query s) : seperti sekarang (selected-event-id := #false); selection dibiarkan
;; on (submit) : -> [IO Job]
;;   tanpa event -> error + toast seperti sekarang;
;;   createJob dengan kind/internationalJenis dari selection;
;;   sukses -> toast 'success' "Job ({job-jenis-label selection}) dibuat."
;;   gagal  -> toast 'error' + error di footer, pesan server (termasuk 403
;;             "Anda hanya dapat membuat job dengan jenis yang Anda pegang.")
```

Contoh:
- Yudi dari IIMS (preset): pilihan jenis hanya "Road Shipment", ada teks bantu, Jalur "Darat"
  terkunci (perilaku Road yang ada).
- Ayu dari `/jobs`: sebelum event dipilih, Jenis nonaktif "Pilih event dulu". Setelah IIMS dipilih:
  enam pilihan, default "TPPB (BC 2.3)", Jalur Laut.
- Rina dari IIMS: enam pilihan, tanpa teks bantu.
- Yudi di `/jobs` mengetik "GJAW": tidak muncul di saran, karena `events` sudah disaring.

```racket
;; EventAccessCard : {event-id : EventId} -> View
;; file: components/event-access-card.tsx ('use client', BERUBAH)
;; perubahan: props menjadi { eventId }; useSession dan perhitungan canManage DIHAPUS
;;   (pemanggil hanya merender bila can-manage-event-access)
;; state: view : [Maybe EventAccessView], #false; selected : String, ""; busy : Boolean, #false
(section.card.p-6.sm:p-8 aria-labelledby="event-access-heading"
  (div.flex.items-center.gap-2 (KeyRound aria-hidden) (h2#event-access-heading "Akses event"))
  (p.mt-1.text-sm.text-slate-600
    "Pengguna yang diberi akses dapat membuat job di event ini dan mengurus job miliknya sendiri. Data event tetap hanya dapat diubah PIC event dan admin.")
  (ul.mt-4.divide-y ...
    (cond [(false? view) (li.py-2.text-slate-500 role="status" "Memuat akses…")]       ; BARU
          [(empty? grantees) (li "Belum ada pengguna yang diberi akses.")]
          [else (map (lambda (g) (li (span fullName)
                                     (button.btn-secondary aria-label="Cabut akses {fullName}"
                                        (Trash2 aria-hidden) "Cabut")))
                     grantees)]))
  (div.mt-4.flex.flex-wrap.items-center.gap-2
    (label.sr-only for="event-access-candidate" "Pilih pengguna")
    (select#event-access-candidate.input.min-w-[14rem] aria-describedby="event-access-help"
      (option "" "Pilih pengguna…") (map option candidates))
    (button.btn-primary disabled=(or busy (string=? selected "")) "Beri akses"))
  (p#event-access-help.mt-2.text-xs.text-slate-500 "Hanya pengguna CS dan Spesialis yang dapat dipilih."))
;; on mount, grant, revoke: tidak berubah (toast sukses/gagal sudah ada, termasuk 403)
```

Contoh: Budi di IIMS, `grantees` = (Rina, Yudi), `candidates` = (Tono, Putri). Fajar tidak muncul
karena disaring server (lihat Kebutuhan untuk Bima 1). Beri akses Tono → toast "Akses event
diberikan.", lalu daftar memuat ulang. Gagal → toast pesan server.

```racket
;; JobNotesPanel : (make-notes-props Job (Job -> Void) Denial) -> View
;; file: components/job-notes-card.tsx · prop baru denial, diteruskan ke JobTextField
;; purpose: kartu catatan job; pemicu ubah tampil untuk semua, menjelaskan saat ditolak
;; JobTextField:
;;   read-only := (eq? status 'CANCELLED)                  ; TIDAK berubah (job batal)
;;   pemicu "Tambah …" dan pensil (aria-label "Ubah …") menjadi GuardedButton #:denial denial,
;;     kelas lama; on-click = start-editing (hanya bila denial #false)
;; contoh:
;;   Rina di S.01, special instruction terisi -> teks tampil (amber) dengan pensil pudar; klik
;;     pensil -> toast "Penerima akses event hanya dapat mengubah job miliknya sendiri.", textarea
;;     tidak terbuka
;;   Rina di S.01, catatan kosong -> "+ Tambah catatan" pudar; klik -> toast yang sama
;;   Rina di A.01 -> seperti sekarang (aktif)
;;   job batal -> "Catatan: Tidak ada catatan." / tanpa pensil (seperti sekarang)

;; JobStageCard : (make-stage-props Job [Maybe Job] JobSeriesState (-> Void) Denial) -> View
;; file: components/job-stage-card.tsx · prop baru create-denial
;; purpose: rangkaian job; tombol buat turunan tampil di job masuk yang belum batal, menjelaskan
;;   saat ditolak
;; can-create := (and (eq? stage 'INBOUND) (not cancelled))  ; TIDAK berubah
;; tombol "Buat job …" menjadi GuardedButton #:denial create-denial, `disabled` saat creating
;;   (seperti sekarang)
;; contoh: Rina di S.01 (BC 2.5 belum ada) -> "BC 2.5 Belum ada" + "Buat job BC 2.5" pudar; klik ->
;;   toast "Penerima akses event hanya dapat mengubah job miliknya sendiri.", tidak ada job dibuat;
;;   Budi -> tombol aktif (toast sukses/gagal yang ada)

;; JobCustomsCard : (make-customs-props Job [Maybe Job] (Job -> Void) Denial) -> View
;; file: components/job-customs-card.tsx · prop baru denial, diteruskan ke CustomsForm
;; purpose: form dokumen pabean; tampil sebagai data bila tidak boleh diubah
;; CustomsForm:
;;   fieldset disabled := (or (eq? status 'CANCELLED) (string? denial))
;;   tombol Simpan: (cond [(eq? status 'CANCELLED) tidak dirender]                 ; seperti sekarang
;;                        [else (GuardedButton type="submit" #:denial denial
;;                                             class="btn-primary" disabled=saving
;;                                (if saving "Menyimpan…" "Simpan"))])
;;   ; Simpan berada di luar fieldset (sudah begitu), jadi tetap bisa difokus dan dicoba
;; contoh: Rina di S.01 -> nilai AJU/pendaftaran terbaca di field nonaktif; Simpan pudar; klik ->
;;   toast "Penerima akses event hanya dapat mengubah job miliknya sendiri.", form tidak terkirim;
;;   Budi -> field aktif, Simpan aktif (toast sukses/gagal yang ada)

;; JobPartyInvoiceCard : (make-party-props Job [Maybe [List-of Exhibitor]] (Job -> Void) Denial) -> View
;; file: components/job-party-invoice-card.tsx · prop baru party-denial
;; purpose: kartu Pihak · Tagihan; "Ubah" Pihak tampil untuk semua dan menjelaskan saat ditolak
;; editButton('party') menjadi GuardedButton #:denial party-denial (kelas lama); syarat tampil lama
;;   (tidak sedang mengedit, job tidak batal) tetap
;; "Ubah" Tagihan TIDAK berubah: tetap hanya dirender bila useCanEditBilling (di luar B6)
;; contoh: Fajar di S.01 -> Pihak "Ubah" pudar (klik -> "Finance hanya dapat mengubah tagihan
;;   job."), Tagihan "Ubah" aktif; Rina di A.01 -> Pihak "Ubah" aktif, Tagihan tanpa "Ubah" (seperti
;;   sekarang); Rina di S.01 -> Pihak "Ubah" pudar (klik -> alasan "hanya job miliknya")

;; JobBillingDialog : (make-billing-dialog-props Job ... Boolean) -> View
;; file: sama · prop baru can-edit-party
;; bagian Pihak hanya bila can-edit-party; bagian Tagihan tetap useCanEditBilling;
;; garis pemisah `border-t pt-4` pada Tagihan hanya bila bagian Pihak tampil
;; invariant: dialog hanya dibuka bila (or can-edit-party billing?), dijaga tab-action-denial
;; contoh: Fajar -> dialog berisi Tagihan saja
```

### Server / client

| Komponen / modul | Jenis |
|---|---|
| `EventsPage`, `EventList` | Server Component (impor dari `@/features/auth/write-scope`) |
| `EventCardActions`, `EventDetailPage`, `EventAccessCard`, `JobsPage`, `JobDetail`, `JobRow`, `JobCreateWizard`, `JobNotesPanel`, `JobStageCard`, `JobCustomsCard`, `JobPartyInvoiceCard`, `JobBillingDialog`, `CiplEntryModal`, `CiplLineModal`, `SettingsManager`, `ActionMenu` | `'use client'` (sudah) |
| `components/guarded-button.tsx` (`GuardedButton`, `denyWrite`) | `'use client'` (BARU; event handler + toast) |
| `lib/use-write-access.ts` | `'use client'` (hook) |
| `lib/write-access.ts`, `lib/job-jenis.ts`, `domain/exhibition/cipl-autofill.ts` | murni, tanpa direktif |

### Aksesibilitas

- **Tombol nonaktif tetap terjangkau.** Penolakan memakai `aria-disabled="true"`, bukan atribut
  `disabled`, sehingga:
  - tombol tetap ada di urutan Tab dan dibacakan "tidak tersedia/dimmed" oleh pembaca layar;
  - Enter, Spasi, klik, dan sentuhan sama-sama memicu alasan (`deny-write`), jadi pengguna layar
    sentuh dan keyboard mendapat penjelasan yang sama; tidak ada yang bergantung pada hover;
  - aksinya tidak berjalan (submit dicegah, dialog tidak terbuka).
- **Alasan diumumkan.** Toast `'error'` dirender `role="alert"` di wadah `aria-live`, jadi alasan
  dibacakan tanpa memindahkan fokus. Fokus tetap di tombol yang dicoba (butir menu: fokus kembali
  ke tombol ⋮). Toast bertahan 6,5 detik dan punya tombol "Tutup notifikasi".
- **Butir menu nonaktif** tetap ikut navigasi panah/Home/End, diberi ikon `Lock` (`aria-hidden`)
  sebagai penanda visual selain warna, dan teks `text-slate-500` di putih (kontras 4,8:1).
- **Kontras tampilan pudar.** `opacity-50` mengikuti `disabled:opacity-50` yang sudah dipakai `.btn`.
  WCAG 1.4.3 mengecualikan komponen yang tidak aktif; label tetap terbaca dan ikon pensil/gembok
  ikut menjelaskan.
- **Yang disembunyikan** (Event baru, menu kelola event, kartu Akses event) tidak pernah masuk urutan
  Tab bagi yang tidak berhak, jadi tidak ada tombol mati tanpa penjelasan.
- **Target sentuh** tombol yang ada tidak diubah (B6 tidak menambah tombol baru selain yang sudah
  ada); pensil catatan (32 px) dan tombol header (36 px) di bawah 44 px adalah kondisi lama, dicatat
  sebagai kandidat perbaikan, bukan bagian B6.
- **Settings:**
  - pilihan jenis memakai `fieldset` + `legend` (nama grup dibacakan);
  - setiap checkbox ada di dalam `label` dengan tinggi minimal 44 px (`min-h-11`);
  - galat memakai `role="alert"`, dihubungkan lewat `aria-describedby`, dan saat submit gagal fokus
    pindah ke checkbox pertama;
  - teks bantu peran dihubungkan ke `select` lewat `aria-describedby`.
- **Wizard:** select Jenis yang nonaktif tetap punya label "Jenis job" dan opsi "Pilih event dulu".
  Teks bantu dihubungkan lewat `aria-describedby`.
- **Kartu akses:**
  - `select` calon punya label (sr-only, bukan hanya `aria-label`) dan teks bantu;
  - tombol Cabut punya nama unik per orang ("Cabut akses Rina");
  - keadaan memuat diumumkan lewat `role="status"`;
  - ikon `KeyRound` dan `Trash2` diberi `aria-hidden`.
- **Toast** tetap di kanan bawah lewat `ToastViewport` yang ada. Galat per field tidak digandakan
  sebagai toast (Settings: galat jenis hanya inline).
- **Kontras dan warna:** tidak ada teks oranye. Galat memakai `text-rose-700`. Checkbox memakai
  `accent-orange-600`, sama dengan wizard ("Tanpa agent"). Tombol oranye yang pudar tetap
  permukaan oranye, bukan teks oranye.
- **Tata letak:** tombol tulis job dirender sejak hak dimuat, jadi tidak ada pergeseran saat hak
  siap. Header job sudah `flex-wrap`. Sel aksi tabel event tetap dirender dengan lebar tetap 56 px.

### Wishlist

Semua item sudah didesain di atas. Wishlist kosong.

- [x] `job-write-denial-reason`, `denied-job-reason`, `job-permissions`, `job-create-denial-reason`,
      `tab-action-denial`, `creatable-jenis`, `can-manage-event-access` (`lib/write-access.ts`)
- [x] ~~`job-read-only-notice`~~ dihapus (revisi 20 Nov, catatan baca-saja ditiadakan)
- [x] `deny-write`, `GuardedButton` (`components/guarded-button.tsx`)
- [x] `ActionMenu` (`deniedReason` per butir)
- [x] `job-jenis-list-label` (`lib/job-jenis.ts`)
- [x] `unfilled-exhibitors-message` (`domain/exhibition/cipl-autofill.ts`, kalimat kedua baru)
- [x] `useWriteAccess` (`lib/use-write-access.ts`, tanpa toast saat gagal)
- [x] `EventsPage`, `EventList`, `EventCardActions`
- [x] `EventDetailPage`, `EventAccessCard`, `JobRow`
- [x] `JobsPage`, `JobCreateWizard`
- [x] `JobDetail`, `JobNotesPanel`, `JobStageCard`, `JobCustomsCard`, `JobPartyInvoiceCard`, `JobBillingDialog`
- [x] `SettingsManager` (bagian Pengguna)
- [x] `CiplEntryModal`, `CiplLineModal`

### Kebutuhan untuk Bima (kontrak)

Semua sudah dipenuhi di desain backend; tidak ada kebutuhan data baru dari revisi 20 Nov.

1. [x] Calon penerima akses disaring ke CS dan Spesialis di server (`list-grant-candidates`,
   `grant-target-error`).
2. [x] `domain/user/validation.ts` murni dan aman di klien (`handledJenisError`).
3. [x] Galat Settings per field: `{ error, field: 'handledJobJenis' }` lewat
   `SettingsValidationError`.
4. Revisi "tampil, jelaskan saat dicoba" memakai `jobWriteScope` dan `jobWriteDenial` dari
   `@/features/auth/write-scope` (sudah di-export, murni) dan `Job.createdById` (sudah ada di tipe
   `Job`). Tidak ada endpoint atau field baru.

### Pertanyaan UI (untuk pengguna)

1. [x] **Kartu "Akses event" dipasang di halaman detail event**, di bawah daftar job. Disetujui
   pengguna (20 Nov, sesi implementasi).
2. [x] **Wizard Job baru di `/jobs`: pilih event dulu, baru jenis job.** Disetujui pengguna (20 Nov,
   sesi implementasi).
3. [x] ~~Teks catatan baca-saja di detail job~~. Tidak berlaku lagi: catatan dihapus (komentar
   pengguna 4, 20 Nov). Penggantinya adalah teks alasan saat dicoba (lihat "Contoh pengguna dan
   data UI"); teks itu ikut disetujui lewat tabel "yang dilihat dan dialami tiap orang".
4. **`CiplLineModal` dan `JobManifestEditorModal` tidak dipakai di halaman mana pun.** Desain di
   atas tetap mengubah `CiplLineModal` agar aman bila dipasang lagi. Perlu diputuskan apakah
   keduanya dihapus (di luar B6; dibiarkan sebagai catatan).

## Pertanyaan untuk Pak Kur

Semua pertanyaan backend B6 sudah diputuskan pengguna (requirements.md, "Keputusan pengguna
(20 Nov, lanjutan)").

- [x] **1. Exhibitor yang dipakai beberapa job milik orang berbeda: diizinkan lewat job milik
      sendiri** (keputusan 20 Nov, sesi implementasi, opsi (b); menggantikan keputusan `'SHARED`
      sebelumnya). Penerima akses tetap hanya boleh lewat job miliknya yang mencantumkan exhibitor
      itu (`'JOB_NOT_WRITABLE`, `'NOT_LINKED`). Hall/booth tetap di master exhibitor event, jadi
      ubahan lewat satu job terlihat di job lain; efek ini diterima sampai fase 2, saat hall/booth
      dipindah ke baris CIPL per job (opsi B Pak Kur).
- [x] **2. Calon penerima akses: disaring ke CS dan Spesialis.** Didesain di "Calon penerima
      akses". Admin juga ditolak sebagai target.
- [x] **3. Venue/EO inline: hanya admin.** `reference:create` dicabut dari CS.
- [x] **4. `LOCAL` boleh dipegang Spesialis.** `JobJenis` tetap memuat `'LOCAL'`.
