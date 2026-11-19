# 7. Pregled prevzetega projekta – TripHarbor

**Datum pregleda:** 19. 11. 2026  
**Pregledana različica:** `main`, commit `224e261`  
**Način pregleda:** dokumentacija, ADR, izvorna koda ter lokalni zagon s PostgreSQL, backendom in frontendom.

## 7.1 Povzetek

TripHarbor je aplikacija za odkrivanje, načrtovanje in organizacijo skupinskih izletov. Projekt je zasnovan kot tridelna aplikacija:

- **Frontend:** React 19, TypeScript, Tailwind CSS, React Router in Vite.
- **Backend:** Node.js, Express in TypeScript, organiziran kot modularni monolit.
- **Podatkovna baza:** PostgreSQL s Prisma ORM in migracijami.
- **Avtentikacija in validacija:** JWT, bcrypt in Zod.
- **Zemljevid:** MapLibre GL JS z OpenFreeMap; iskanje destinacij v kodi uporablja Geoapify.

Aplikacija je bila uspešno zagnana lokalno. Backend je tekel na `http://localhost:3000`, frontend na `http://localhost:5173`, migracije so bile uspešno uporabljene, za potrebe pregleda pa je bilo ustvarjenih 12 objavljenih izletov. Preverjeni so bili javni pregled izletov, zemljevid, prijava uporabnika in organizatorski nadzorni panel.

## 7.2 Implementirane funkcionalnosti

### Osnovne in podporne funkcionalnosti

- Registracija, prijava, odjava in obnovitev seje.
- Vloge `PARTICIPANT`, `ORGANIZER` in `ADMIN` z omejitvami na backendu.
- Urejanje uporabniškega profila.
- Javni pregled objavljenih izletov s paginacijo.
- Iskanje po naslovu, opisu in destinaciji.
- Filtriranje po kategoriji, zahtevnosti in datumskem obdobju.
- Razvrščanje po datumu in naslovu.
- Interaktivni zemljevid z označevalci in povezavo na podrobnosti izleta.

### MVP funkcionalnosti

| Funkcionalnost | Stanje | Opomba |
|---|---|---|
| F-01 Iskanje in filtriranje izletov | Implementirano | Backend vrača samo `PUBLISHED` izlete; iskanje in vsi trije filtri delujejo skupaj. |
| F-02 Interaktivni zemljevid | Implementirano | Prikazani so izleti s koordinatami; označevalec prikaže povzetek in povezavo na izlet. |
| F-03 Priprava izleta in programa | Implementirano | Organizator ustvari osnutek, ureja osnovne podatke ter dodaja, ureja, briše in razvršča aktivnosti. |
| F-04 Preverjanje skladnosti programa | Delno implementirano | Preverjanje datumov in podvojenih začetnih časov deluje; manjka opozorilo za ne-kronološki vrstni red glede na začetne čase. |
| F-05 Prijava na izlet | Implementirano | Prijava, preklic, ponovna prijava po preklicu in pregled lastnih prijav. |
| F-06 Upravljanje prijav in kapacitet | Implementirano | Organizator sprejema/zavrača prijave; transakcija in `pg_advisory_xact_lock` preprečita prekoračitev kapacitete. |
| F-07 Odobritev objave izleta | Implementirano | Administrator odobri ali zavrne izlet, ki je v statusu `PENDING`. |

### Funkcionalnosti, implementirane poleg osnovnega MVP-obsega

- Zahtevki za vlogo organizatorja z administratorskim pregledom.
- Administratorski nadzorni panel s statistiko, upravljanjem uporabnikov in analitiko.
- Odpoved izleta s strani organizatorja ali administratorja.
- Pregled lastnih prijav in statusov.
- Preverjanje skladnosti programa z opozorili, ki niso blokirajoča.

## 7.3 Pregled petih uporabniških zgodb

Za podrobnejši pregled je bilo izbranih prvih pet MVP uporabniških zgodb iz `docs/05-uporabniske-zgodbe.md`.

### US-01 – Iskanje in filtriranje izletov

**Stanje: izpolnjena.**

Backend v `GET /api/trips` privzeto omeji rezultate na status `PUBLISHED`, omogoča iskanje po naslovu, opisu, destinaciji in državi ter filtriranje po kategoriji, zahtevnosti in datumu. Frontend ponuja iskalno polje, filtre, ponastavitev in prazno stanje. Paginacija in razvrščanje sta prav tako implementirana.

**Opombe:** iskanje je smiselno preveriti še z avtomatiziranimi testi, zlasti kombinacijo več filtrov in neveljavnih datumov.

### US-02 – Interaktivni zemljevid izletov

**Stanje: izpolnjena.**

Zemljevid prikaže označevalce za objavljene izlete, ki imajo koordinate. Ob izbiri označevalca se prikažejo naslov, destinacija, datumi in povezava na podrobnosti. Uporabljeni sta MapLibre GL JS in OpenFreeMap; ob napaki nalaganja zemljevida se prikaže opozorilo, seznam izletov pa ostane uporaben.

**Opombe:** delovanje je odvisno od zunanje storitve OpenFreeMap. Dokumentacija omenja Nominatim, dejanska koda pa za iskanje destinacij uporablja Geoapify.

### US-03 – Priprava izleta in načrtovanje programa

**Stanje: izpolnjena ob pravilno nastavljenem okolju.**

Organizator lahko ustvari osnutek z vsemi zahtevanimi podatki. Backend preveri, da je končni datum na ali po začetnem in da je kapaciteta vsaj 1. Aktivnosti je mogoče dodajati, urejati, brisati in razvrščati; lastništvo in status osnutka se preverjata na strežniku.

**Opombe:** za iskanje destinacij v uporabniškem vmesniku je potreben `GEOAPIFY_API_KEY` oziroma `VITE_GEOAPIFY_API_KEY`. Brez ključa je mogoče uporabljati obstoječe izlete, ne pa tudi iskanja novih destinacij prek zemljevida. Ta nastavitev v README ni dovolj jasno dokumentirana.

### US-04 – Samodejno preverjanje skladnosti programa

**Stanje: delno izpolnjena.**

Implementirano je preverjanje, ali so aktivnosti zunaj datumov izleta, opozarjanje na podvojene začetne čase in opozarjanje na podvojen vrstni red. Neveljavnih datumov ni mogoče shraniti prek obstoječih API-potij, zato je invariant vzpostavljen že pri ustvarjanju in urejanju aktivnosti.

**Manjkajoči del:** sistem ne opozori, kadar vrstni red aktivnosti (`sort_order`) na posamezen dan ni skladen z naraščajočimi začetnimi časi. Prav tako ob oddaji v pregled ni ponovnega preverjanja, ampak se zanaša na prejšnje validacije. To je treba dopolniti ali jasneje dokumentirati.

### US-05 – Prijava na izlet

**Stanje: izpolnjena.**

Prijavljeni uporabnik se lahko prijavi samo na objavljen izlet, ki se še ni začel. Sistem prepreči podvojeno aktivno prijavo, omogoči preklic in ponovno uporabo preklicane prijave. Po zavrnitvi samodejna ponovna prijava ni dovoljena. Uporabnik vidi samo svoje prijave in njihove statuse. Kapaciteta se preverja ob prijavi in ob potrjevanju.

**Opombe:** sočasne prijave in potrjevanja so zaščitene s transakcijami in svetovalno ključavnico. Za to vedenje je priporočljiv integracijski test s hkratnimi zahtevami.

## 7.4 Ugotovitve in tveganja

1. **MVP je v veliki meri dokončan.** Vseh sedmih ključnih funkcionalnosti je prisotnih, pri čemer je US-04 delno izpolnjena.
2. **Ni avtomatiziranih testov.** V repozitoriju ni testnega ogrodja, testov, lintanja backenda ali CI/CD-cevovoda. To je glavna vrzel za drugi del naloge.
3. **Dokumentacija ni popolnoma usklajena s kodo.** Namesto Nominatima se uporablja Geoapify, manjka pa tudi opis okoljskih spremenljivk zanj. Nekatera imena API-potij v arhitekturnem dokumentu se razlikujejo od implementacije.
4. **Dodatne funkcionalnosti presegajo MVP.** Zahtevki za organizatorje, administracija uporabnikov, analitika in odpoved izletov so implementirani, čeprav so v dokumentaciji označeni kot kasnejši.
5. **Obstaja `postinstall` ukaz `prisma skills sync || exit 0`.** Ukaz v nameščeni različici Prisma ne obstaja, zato se napaka tiho ignorira; v mapah `.agents`, `.claude`, `.cursor` in `.devin` so shranjene generirane Prisma-agentne smernice. Za CI je bolje uporabiti eksplicitni `prisma generate` in te mape odstraniti ali jasno označiti kot generirane.
6. **Varnostni pregled ni pokazal zlonamerne kode.** V izvorni kodi ni `child_process`, `eval`, `exec`, zakodiranih payloadov ali trdo zapisanih skrivnosti. Zunanji klici so omejeni na Geoapify, Unsplash in OpenFreeMap.

## 7.5 Priporočila pred nadaljnjim razvojem

- Dodati ESLint/Oxlint in Ruff oziroma ustrezno TypeScript-lintanje za backend.
- Uvesti vsaj 15 avtomatiziranih testov za avtentikacijo, iskanje, validacijo programa, prijave, kapacitete in administratorski pregled.
- Vzpostaviti GitHub Actions z jobi `lint`, `build`, `test` in `deploy`.
- Dodati pokritost kode in jo shraniti kot artefakt.
- Uskladiti dokumentacijo glede Geoapify in okoljskih spremenljivk.
- Dodati manjkajoče preverjanje kronološkega vrstnega reda aktivnosti.
- Pripraviti produkcijsko konfiguracijo za PostgreSQL in javni deployment.
