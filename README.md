# TripHarbor

TripHarbor je spletna aplikacija za odkrivanje, načrtovanje in organizacijo skupinskih izletov. Udeležencem omogoča iskanje izletov, pregled podrobnosti in prijavo na izlete. Organizatorji lahko pripravljajo programe aktivnosti in upravljajo prijave, administratorji pa odobravajo objave izletov.

## Uporabljene tehnologije

- **Frontend:** React, TypeScript, Tailwind CSS, React Router, Vite
- **Backend:** Node.js, Express, TypeScript
- **Podatkovna baza:** PostgreSQL
- **ORM:** Prisma ORM, Prisma Migrate
- **Avtentikacija:** JWT, bcrypt
- **Validacija podatkov:** Zod
- **Zemljevid:** MapLibre GL JS, OpenFreeMap, Geoapify
- **Razvojna orodja:** Docker Compose, Git, GitHub

## Status in namestitev

[![CI/CD](https://github.com/nacoraco/TripHarbor/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/nacoraco/TripHarbor/actions/workflows/ci-cd.yml)

- **Javna aplikacija:** https://nacoraco.github.io/TripHarbor/
- **Backend API:** https://tripharbor-api.onrender.com/api/health
- **Produkcijska baza:** Render Postgres (free)

Cevovod GitHub Actions se zažene ob pull requestu in ob pushu na `main`. Jobi `lint`, `build` in `test` preverijo kakovost kode, zgradijo frontend/backend ter zaženejo teste s poročilom o pokritosti. Job `deploy` se izvede samo ob pushu na `main`, ko uspejo vsi prejšnji jobi, in uporabi artefakte gradnje za GitHub Pages ter produkcijsko sliko backenda.

## Lokalni zagon

### Predpogoji

Za lokalni zagon aplikacije potrebujete:

- Node.js in npm
- PostgreSQL
- Git

### 1. Kloniranje repozitorija

```bash
git clone https://github.com/nacoraco/TripHarbor.git
cd TripHarbor
```

### 2. Nastavitev podatkovne baze

V PostgreSQL ustvarite podatkovno bazo `tripharbor` in uporabnika `tripharbor_user` z ustreznimi pravicami za dostop do podatkovne baze.

Povezava s podatkovno bazo se nastavi v datoteki `backend/.env` s spremenljivko `DATABASE_URL`.

### 3. Namestitev in zagon backenda

V terminalu izvedite:

```bash
cd backend
npm install
```

V direktoriju `backend/` ustvarite datoteko `.env` in nastavite naslednje okoljske spremenljivke:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://tripharbor_user:YOUR_PASSWORD@localhost:5432/tripharbor?schema=public"
JWT_SECRET=replace_with_a_secure_random_secret
GEOAPIFY_API_KEY=
```

Vrednost `YOUR_PASSWORD` zamenjajte z geslom uporabnika PostgreSQL, `JWT_SECRET` pa z varno naključno vrednostjo.

Izvedite migracije podatkovne baze in generirajte Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Zaženite backend:

```bash
npm run dev
```

Backend je dostopen na naslovu `http://localhost:3000`.

### 4. Namestitev in zagon frontenda

Odprite nov terminal v glavnem direktoriju projekta in izvedite:

```bash
cd frontend
npm install
npm run dev
```

Frontend je dostopen na naslovu `http://localhost:5173`.

Backend in frontend morata med uporabo aplikacije delovati sočasno. Za iskanje destinacij nastavite `VITE_GEOAPIFY_API_KEY` v `frontend/.env`, za backend pa `GEOAPIFY_API_KEY` v `backend/.env`. Brez ključa osnovni pregled izletov deluje, iskanje novih destinacij pa ne.

### 5. Administratorski račun

Za ustvarjanje administratorskega računa je na voljo skripta `backend/scripts/create-admin.ts`.

V datoteki `backend/.env` nastavite dodatni okoljski spremenljivki:

```env
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-secure-password"
```

Administratorsko geslo mora vsebovati najmanj 12 znakov. Skripta ustvari račun z vlogo `ADMIN` in geslo varno shrani z uporabo bcrypt.

Skripto za ustvarjanje administratorskega računa zaženite po uspešni nastavitvi podatkovne baze in izvedbi migracij.

### 6. Testi in preverjanje kakovosti

```bash
cd backend
npm run lint
npm test
npm run test:coverage

cd ../frontend
npm run lint
npm test
npm run test:coverage
```


## Dokumentacija

Projektna dokumentacija je shranjena v direktoriju [`docs/`](docs/).

- [Zasnova rešitve](docs/01-zasnova-resitve.md)
- [Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
- [Podatkovni model](docs/03-podatkovni-model.md)
- [Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
- [Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)
- [Wireframes](docs/06-wireframes.md)
- [Arhitekturne odločitve (ADR)](docs/adr/)

## Struktura projekta

- `frontend/` – odjemalski del aplikacije
  - `src/components/` – ponovno uporabne komponente uporabniškega vmesnika
  - `src/pages/` – strani aplikacije
  - `src/services/` – komunikacija z zalednim API-jem
- `backend/` – strežniški del aplikacije
  - `src/routes/` – definicije API-poti
  - `prisma/` – podatkovni model in migracije podatkovne baze
  - `scripts/` – pomožne skripte za upravljanje aplikacije
- `docs/` – projektna dokumentacija
  - `adr/` – zapisi arhitekturnih odločitev
