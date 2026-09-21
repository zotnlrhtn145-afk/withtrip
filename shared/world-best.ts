import { BEST_HISTORY, BEST_DISCOVERY } from "./world-best-history"
/** Official list facts. Editions follow each list's metadata, not the current year.
 * Regional lists are independent rankings; a venue can appear on more than one.
 * World bars currently publishes 99 rows (rank 94 absent); never invent missing ranks.
 * Sources: https://www.the50.com/restaurants/ and https://www.the50.com/bars/
 */
export type BestScope = "world" | "asia" | "europe" | "north-america" | "latin-america" | "middle-east-and-north-africa" | "discovery"
export const BEST_SCOPE_LABELS: Record<BestScope, string> = {discovery:"Discovery",world:"세계",asia:"아시아",europe:"유럽","north-america":"북미","latin-america":"중남미","middle-east-and-north-africa":"중동·북아프리카"}
type BestVenue = { kind: "restaurants" | "bars"; name: string; city: string; url: string; address: string; googlePlaceId?: string }
export type WorldBest = BestVenue & (
  | { recognition?: "ranked"; scope?: Exclude<BestScope, "discovery">; year: number; rank: number }
  | { recognition: "discovery"; scope: "discovery"; observedAt: string; year?: never; rank?: never }
)
export const CURRENT_WORLD_BEST: WorldBest[] = [
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 1,
    "name": "Maido",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/maido.html",
    "address": "San Martín 399, Miraflores, Lima, Peru",
    "googlePlaceId": "ChIJObzkJx_IBZERAQaFKNwiTws"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 2,
    "name": "Asador Etxebarri",
    "city": "Atxondo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/Asador-Etxebarri.html",
    "address": "San Juan Plaza, 1, 48291 Axpe, Bizkaia, Spain",
    "googlePlaceId": "ChIJfwMp6PLSTw0RFlSWXV3fkio"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 3,
    "name": "Quintonil",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/quintonil.html",
    "address": "Newton 55, Polanco, 11560, Mexico City, Mexico",
    "googlePlaceId": "ChIJbS8EZf8B0oURwwD8B0MpqK0"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 4,
    "name": "Diverxo",
    "city": "Madrid",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/diverxo.html",
    "address": "NH Eurobuilding, C. del Padre Damián, 23, 28036 Madrid, Spain",
    "googlePlaceId": "ChIJfUIagAMpQg0RRYLx9K82nJc"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 5,
    "name": "Alchemist",
    "city": "Copenhagen",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/alchemist.html",
    "address": "Refshalevej 173C, 1432 Copenhagen, Denmark",
    "googlePlaceId": "ChIJGbFWVvBSUkYR5x0i6Z836Ao"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 6,
    "name": "Gaggan",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/gaggan.html",
    "address": "68 Sukhumvit 31, Khlong Tan Nuea, Watthana, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJi_nHcf-f4jARAI6VOXH0wII"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 7,
    "name": "Sézanne",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/sezanne.html",
    "address": "1 Chome-11-1 Marunouchi, Chiyoda City, Tokyo 100-6277, Japan",
    "googlePlaceId": "ChIJ-4nJtO-LGGARLkDEsx6UD4g"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 8,
    "name": "Table by Bruno Verjus",
    "city": "Paris",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/table-by-bruno-verjus.html",
    "address": "3 rue de Prague, 75012 Paris, France",
    "googlePlaceId": "ChIJoSONvAVy5kcRiFFvBHOUYv8"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 9,
    "name": "Kjolle",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/kjolle.html",
    "address": "Av. Pedro de Osma 301, Barranco,15063 Lima, Peru",
    "googlePlaceId": "ChIJr1L1USC3BZEREp0Z1sp3AeU"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 10,
    "name": "Don Julio",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/don.html",
    "address": "Guatemala 4691, Palermo Viejo, Buenos Aires, Argentina",
    "googlePlaceId": "ChIJoYl36oa1vJURWWhqD9z3UV8"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 11,
    "name": "Wing",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/wing.html",
    "address": "29/F The Wellington, 198 Wellington St, Central, Hong Kong",
    "googlePlaceId": "ChIJ9TB5jAcBBDQREQJ8mH5EaVw"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 12,
    "name": "Atomix",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/atomix.html",
    "address": "104 E. 30th St. New York, NY 10016, USA",
    "googlePlaceId": "ChIJ3bmAHghZwokRRXYO57yLuss"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 13,
    "name": "Potong",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/potong.html",
    "address": "422 Vanich Rd. Samphanthawong Bangkok, 10100, Thailand",
    "googlePlaceId": "ChIJd7grWxeZ4jAR8KwClMpGmHo"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 14,
    "name": "Plénitude",
    "city": "Paris",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/plenitude.html",
    "address": "Cheval Blanc Paris 8, Quai du Louvre, 75001 Paris, France",
    "googlePlaceId": "ChIJ1YFmqNZv5kcRBAVR2JH8pEo"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 15,
    "name": "Ikoyi",
    "city": "London",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/ikoyi.html",
    "address": "180 The Strand, London, Greater London, WC2R 1EA, UK",
    "googlePlaceId": "ChIJkw2CZtEEdkgRgiNBxbdniHE"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 16,
    "name": "Lido 84",
    "city": "Gardone Riviera",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/lido-84.html",
    "address": "Corso Zanardelli 196, 25083, Gardone Riviera (BS), Italy",
    "googlePlaceId": "ChIJx7BJHCKMgUcRA7aurgztHrQ"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 17,
    "name": "Sorn",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/sorn.html",
    "address": "56 Soi Sukhumvit 26, Klongton Khlong Toei, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJWfYJ3QWf4jAR9erXv7kK7sA"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 18,
    "name": "Reale",
    "city": "Castel di Sangro",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/reale.html",
    "address": "Piana Santa Liberata, 67031, Castel di Sangro (AQ), Italy",
    "googlePlaceId": "ChIJnxxH1W96MBMRSkUGag8Oltc"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 19,
    "name": "The Chairman",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/the-chairman.html",
    "address": "3rd Floor, The Wellington, 198 Wellington St, Central, Hong Kong",
    "googlePlaceId": "ChIJhcOtY3wABDQR39uGw41EIYM"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 20,
    "name": "Atelier Moessmer Norbert Niederkofler",
    "city": "Brunico",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/atelier-moessmer-norbert-niederkofler.html",
    "address": "Via Walther von der Vogelweide, Brunico, 39031",
    "googlePlaceId": "ChIJf6LW4bcheEcRuUfcDFw1q30"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 21,
    "name": "Narisawa",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/narisawa.html",
    "address": "Japan, 〒107-0062 Tokyo, Minato City, Minamiaoyama, 2 Chome−6−15",
    "googlePlaceId": "ChIJrbAVNIOMGGARXNvkApcqvng"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 22,
    "name": "Sühring",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/suhring.html",
    "address": "10 Yen Akat Soi 3, Chongnonsi, Yannawa, Bangkok 10120",
    "googlePlaceId": "ChIJa4FyWkef4jARYosTC995W8U"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 23,
    "name": "Boragó",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/borago.html",
    "address": "San José María Escrivá de Balaguer 5970, Región Metropolitana, Santiago, 7640804, Chile",
    "googlePlaceId": "ChIJxSErG0jPYpYRoyEeWBQK0Dk"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 24,
    "name": "Elkano",
    "city": "Getaria",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/elkano.html",
    "address": "Herrerieta Kalea, 2, 20808 Getaria, Gipuzkoa, Spain",
    "googlePlaceId": "ChIJH9GgGaLIUQ0RhEde7VfKpQI"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 25,
    "name": "Odette",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/odette.html",
    "address": "1 St Andrew's Rd, #01-04 National Gallery, Singapore 178957",
    "googlePlaceId": "ChIJbUjtT6cZ2jERJOB8kHFKljI"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 26,
    "name": "Mérito",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/merito.html",
    "address": "Av. 28 de Julio 206, Barranco, Lima, 15063, Peru",
    "googlePlaceId": "ChIJJW2CECq3BZER0acewjEiZZ8"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 27,
    "name": "Trèsind Studio",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/tresind-studio.html",
    "address": "St. Regis Gardens Entrance B - The Palm Jumeirah - Dubai",
    "googlePlaceId": "ChIJcfzwzo0TXz4RyQpaHkMBWsE"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 28,
    "name": "Lasai",
    "city": "Rio de Janeiro",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/lasai.html",
    "address": "Largo dos Leões 35, Humaitá Rio de Janeiro / RJ – 22260-210",
    "googlePlaceId": "ChIJhWl8Qd5_mQAR-xc4FQjSFaQ"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 29,
    "name": "Mingles",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/mingles.html",
    "address": "Seoul, Gangnam-gu, Dosan-daero 67-gil, 19",
    "googlePlaceId": "ChIJjXuM24mjfDURSwmouRnxNlM"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 30,
    "name": "Le Du",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/le-du.html",
    "address": "399/3 Silom 7 Alley, Silom, Bang Rak, Bangkok 10500, Thailand",
    "googlePlaceId": "ChIJL7-My9KY4jARzlw1ffk9vo8"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 31,
    "name": "Le Calandre",
    "city": "Rubano",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/le-calandre.html",
    "address": "Via Liguria 1, 35030 Rubano (PD)",
    "googlePlaceId": "ChIJRwG9TKLZfkcRqCF9Hf_ANrk"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 32,
    "name": "Piazza Duomo",
    "city": "Alba",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/piazza-duomo.html",
    "address": "Piazza Risorgimento 4, Alba (CN) 12051, Italy",
    "googlePlaceId": "ChIJSw-GLl2z0hIRX8zyKXltoq8"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 33,
    "name": "Steirereck",
    "city": "Vienna",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/steirereck.html",
    "address": "Steirereck, Am Heumarkt 2A im Stadtpark A-1030 Vienna, Austria",
    "googlePlaceId": "ChIJKS_u4XYHbUcRFEBBkdJ8HG0"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 34,
    "name": "Enigma",
    "city": "Barcelona",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/enigma.html",
    "address": "Carrer de Sepúlveda 38, Sant Antoni, Barcelona, Catalonia, 8015",
    "googlePlaceId": "ChIJA6vUunyipBIRMtoRD_vIbII"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 35,
    "name": "Nusara",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/nusara.html",
    "address": "336 Maha Rat Rd, Phra Borom Maha Ratchawang, Khet Phra Nakhon, Bangkok 10200, Thailand",
    "googlePlaceId": "ChIJe_d6d0OZ4jARL0uQgNHQRPI"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 36,
    "name": "Florilège",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/florilege.html",
    "address": "Japan, 〒105-0001 Tokyo, Minato City, Toranomon, 5 Chome−10−7",
    "googlePlaceId": "ChIJhU8r4Ba6JhUR2uFksk0mpCg"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 37,
    "name": "Orfali Bros",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/orfali-bros.html",
    "address": "D92 - Jumeirah - Jumeirah 1 - Dubai - United Arab Emirates",
    "googlePlaceId": "ChIJv6Zm1-hDXz4R9c0k9cOGun4"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 38,
    "name": "Frantzén",
    "city": "Stockholm",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/frantzen.html",
    "address": "Klara Norra Kyrkogatan 26, 11122 Stockholm, Sweden",
    "googlePlaceId": "ChIJhwomM2edX0YR9gW2q53gJRg"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 39,
    "name": "Mayta",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/mayta.html",
    "address": "Av. Mariscal La Mar 1285, Miraflores 15027, Peru",
    "googlePlaceId": "ChIJqz8RPjbIBZERTyuxNQ8LNHs"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 40,
    "name": "Septime",
    "city": "Paris",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/septime.html",
    "address": "80, Rue de Charonne, Paris 11, France",
    "googlePlaceId": "ChIJE6kCUghy5kcRmWSg3RUHIwM"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 41,
    "name": "Kadeau",
    "city": "Copenhagen",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/kadeau.html",
    "address": "Wildersgade 10B, 1408 København",
    "googlePlaceId": "ChIJ1Y52MZlTUkYRuDl4FNhYh_U"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 42,
    "name": "Belcanto",
    "city": "Lisbon",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/belcanto.html",
    "address": "Rua Serpa Pinto, 10 A, 1200-445 Lisbon, Portugal",
    "googlePlaceId": "ChIJITj75340GQ0RXULVgWMFloA"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 43,
    "name": "Uliassi",
    "city": "Senigallia",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/uliassi.html",
    "address": "Via Banchina di Levante 6, 60019 Senigallia, Ancona, Italy",
    "googlePlaceId": "ChIJcR28_J1zLRMRk_P3vABNEog"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 44,
    "name": "La Cime",
    "city": "Osaka",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/la-cime.html",
    "address": "3 Chome-2-15 Kawaramachi, Chuo Ward, Osaka, 541-0048, Japan",
    "googlePlaceId": "ChIJJQbuz-HmAGARlT3utlf3bPA"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 45,
    "name": "Arpège",
    "city": "Paris",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/arpege.html",
    "address": "84 Rue de Varenne, 75007 Paris, France",
    "googlePlaceId": "ChIJQ-oAFypw5kcR2T9NszPcZO4"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 46,
    "name": "Rosetta",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/rosetta.html",
    "address": "Colima 166, Colonia Roma Norte 06700, Mexico City, Mexico",
    "googlePlaceId": "ChIJdSGAWgP_0YURwNtY7rftf2E"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 47,
    "name": "Vyn",
    "city": "Skillinge",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/vyn.html",
    "address": "Höga vägen 72, 272 92 Simrishamn",
    "googlePlaceId": "ChIJLbEtuLtvVEYRhbjWJlyxJlI"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 48,
    "name": "Celele",
    "city": "Cartagena",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/celele.html",
    "address": "Calle del Espiritu Santo, cr 10c # 29 – 200, Getsemaní, Cartagena, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 49,
    "name": "Kol",
    "city": "London",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/kol.html",
    "address": "Lower Ground Floor, 9 Seymour St, London W1H 7BA, UK",
    "googlePlaceId": "ChIJvfnOCgUbdkgR3FvbixhS2cw"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 50,
    "name": "Jan",
    "city": "Munich",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/restaurant-jan.html",
    "address": "Restaurant JAN, Luisenstraße 27, 80333 Munich, Germany",
    "googlePlaceId": "ChIJrW8egwN1nkcRcSAVCJYQpZY"
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 51,
    "name": "Alcalde",
    "city": "Guadalajara",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 52,
    "name": "Schloss Schauenstein",
    "city": "Fürstenau",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 53,
    "name": "Den",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 54,
    "name": "El Chato",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 55,
    "name": "La Colombe",
    "city": "Cape Town",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 56,
    "name": "Jordnær",
    "city": "Copenhagen",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 57,
    "name": "Onjium",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 58,
    "name": "Restaurant Tim Raue",
    "city": "Berlin",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 59,
    "name": "Nobelhart & Schmutzig",
    "city": "Berlin",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 60,
    "name": "Pujol",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 61,
    "name": "Nuema",
    "city": "Quito",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 62,
    "name": "Willem Hiele",
    "city": "Oudenburg",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 63,
    "name": "Bozar",
    "city": "Brussels",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 64,
    "name": "Fu He Hui",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 65,
    "name": "Quique Dacosta",
    "city": "Dénia",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 66,
    "name": "Saint Peter",
    "city": "Sydney",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 67,
    "name": "Arca",
    "city": "Tulum",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 68,
    "name": "Masque",
    "city": "Mumbai",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 69,
    "name": "Hiša Franko",
    "city": "Kobarid",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 70,
    "name": "Tuju",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 71,
    "name": "Sazenka",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 72,
    "name": "Chef Tam's Seasons",
    "city": "Macau",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 73,
    "name": "Tantris",
    "city": "Munich",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 74,
    "name": "Mountain",
    "city": "London",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 75,
    "name": "Mil",
    "city": "Cusco",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 76,
    "name": "Leo",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 77,
    "name": "Le Doyenné",
    "city": "Saint-Vrain",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 78,
    "name": "Cocina Hermanos Torres",
    "city": "Barcelona",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 79,
    "name": "Coda",
    "city": "Berlin",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 80,
    "name": "SingleThread",
    "city": "Healdsburg",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 81,
    "name": "Oteque",
    "city": "Rio de Janeiro",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 82,
    "name": "Fyn",
    "city": "Cape Town",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 83,
    "name": "A Casa do Porco",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 84,
    "name": "Aponiente",
    "city": "El Puerto de Santa María",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 85,
    "name": "Txispa",
    "city": "Atxondo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 86,
    "name": "The Clove Club",
    "city": "London",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 87,
    "name": "Mugaritz",
    "city": "San Sebastián",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 88,
    "name": "Salsify at the Roundhouse",
    "city": "Cape Town",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 89,
    "name": "Huniik",
    "city": "Mérida",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 90,
    "name": "Le Bernardin",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 91,
    "name": "Koan",
    "city": "Copenhagen",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 92,
    "name": "Al Gatto Verde",
    "city": "Modena",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 93,
    "name": "Burnt Ends",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 94,
    "name": "Meet the Bund",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 95,
    "name": "Evvai",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 96,
    "name": "Atelier Crenn",
    "city": "San Francisco",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 97,
    "name": "Labyrinth",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 98,
    "name": "César",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 99,
    "name": "Amisfield Restaurant",
    "city": "Queenstown",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "world",
    "year": 2025,
    "rank": 100,
    "name": "Neolokal",
    "city": "Istanbul",
    "url": "https://www.the50.com/restaurants/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 1,
    "name": "The Chairman",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/The-Chairman.html",
    "address": "3rd Floor, The Wellington, 198 Wellington St, Central, Hong Kong",
    "googlePlaceId": "ChIJhcOtY3wABDQR39uGw41EIYM"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 2,
    "name": "Wing",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Wing.html",
    "address": "29/F The Wellington, 198 Wellington St, Central, Hong Kong",
    "googlePlaceId": "ChIJ9TB5jAcBBDQREQJ8mH5EaVw"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 3,
    "name": "Gaggan",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Gaggan.html",
    "address": "68 Sukhumvit 31, Khlong Tan Nuea, Watthana, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJi_nHcf-f4jARAI6VOXH0wII"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 4,
    "name": "Mingles",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/mingles.html",
    "address": "Seoul, Gangnam-gu, Dosan-daero 67-gil, 19",
    "googlePlaceId": "ChIJjXuM24mjfDURSwmouRnxNlM"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 5,
    "name": "Nusara",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Nusara.html",
    "address": "336 Maha Rat Rd, Phra Borom Maha Ratchawang, Khet Phra Nakhon, Bangkok 10200, Thailand",
    "googlePlaceId": "ChIJe_d6d0OZ4jARL0uQgNHQRPI"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 6,
    "name": "Meet the Bund",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Meet-The-Bund.html",
    "address": "56th Floor, West Tower, Raffles City The Bund, Hongkou District, Shanghai, China"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 7,
    "name": "Chef Tam's Seasons",
    "city": "Macau",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Chef-Tams-Seasons.html",
    "address": "Wynn Palace, Av. da Nave Desportiva, Cotai, Macau"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 8,
    "name": "Gaggan at Louis Vuitton",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/gaggan-at-louis-vuitton.html",
    "address": "Unit 2F-S01-B, Second Floor, 502 Phloen Chit Rd, Bangkok 10330, Thailand"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 9,
    "name": "Ling Long",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/ling-long.html",
    "address": "No.2 Zhong Shan Dong Yi Rd Huang Pu District Shanghai, 200002 China"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 10,
    "name": "Ru Yuan",
    "city": "Hangzhou",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Ru-Yuan.html",
    "address": "11 Yuguan Road, Xihu, Hangzhou"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 11,
    "name": "Fu He Hui",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Fu-He-Hui.html",
    "address": "1037 Yu Yuan Road, Changning District, Shanghai"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 12,
    "name": "Sorn",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Sorn.html",
    "address": "56 Soi Sukhumvit 26, Klongton Khlong Toei, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJWfYJ3QWf4jAR9erXv7kK7sA"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 13,
    "name": "La Cime",
    "city": "Osaka",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/La-Cime.html",
    "address": "3 Chome-2-15 Kawaramachi, Chuo Ward, Osaka, 541-0048, Japan",
    "googlePlaceId": "ChIJJQbuz-HmAGARlT3utlf3bPA"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 14,
    "name": "Onjium",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/onjium.html",
    "address": "Seoul, Jongno-gu, Hyoja-ro, 49 4층"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 15,
    "name": "Masque",
    "city": "Mumbai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Masque.html",
    "address": "Nit G3, Laxmi Woollen Mill Shakti Mills Lane, Off Dr. E. Moses Road Mahalaxmi, Mumbai 400011"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 16,
    "name": "Sézanne",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/sezanne.html",
    "address": "1 Chome-11-1 Marunouchi, Chiyoda City, Tokyo 100-6277, Japan",
    "googlePlaceId": "ChIJ-4nJtO-LGGARLkDEsx6UD4g"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 17,
    "name": "Lamdre",
    "city": "Beijing",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/lamdre.html",
    "address": "Room 01, 1F, Block 14, Courtyard 4, Gongti North Road, Chaoyang, Beijing"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 18,
    "name": "Sühring",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Suhring.html",
    "address": "10 Yen Akat Soi 3, Chongnonsi, Yannawa, Bangkok 10120",
    "googlePlaceId": "ChIJa4FyWkef4jARYosTC995W8U"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 19,
    "name": "Odette",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Odette.html",
    "address": "1 St Andrew's Rd, #01-04 National Gallery, Singapore 178957",
    "googlePlaceId": "ChIJbUjtT6cZ2jERJOB8kHFKljI"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 20,
    "name": "Seroja",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/seroja.html",
    "address": "7 Fraser Street, Rochor, Singapore, 189356"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 21,
    "name": "Sazenka",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Sazenka.html",
    "address": "4 Chome-7-5 Minamiazabu, Minato City, Tokyo 106-0047, Japan"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 22,
    "name": "Logy",
    "city": "Taipei",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Logy.html",
    "address": "1F, No.39, Lane 258, Ruiguang Road., Neihu District, Taipei, Taiwan"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 23,
    "name": "Born",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Born.html",
    "address": "1 Neil Rd, #01-01, Singapore 088804"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 24,
    "name": "Neighborhood",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Neighborhood.html",
    "address": "61 Hollywood Rd, Central, Hong Kong"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 25,
    "name": "Potong",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Potong.html",
    "address": "422 Vanich Rd. Samphanthawong Bangkok, 10100, Thailand",
    "googlePlaceId": "ChIJd7grWxeZ4jAR8KwClMpGmHo"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 26,
    "name": "Eatanic Garden",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/eatanic-garden.html",
    "address": "231 Teheran-ro, Gangnam District, Seoul, South Korea 06142"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 27,
    "name": "Ms. Maria & Mr. Singh",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Ms-Maria-Mr-Singh.html",
    "address": "2nd Floor of Gaggan Anand Restaurant, 68 Sukhumvit 31, Sukhumvit Road, Klongton-Neu, Wattana, Bangkok 10110"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 28,
    "name": "Maz",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/maz.html",
    "address": "Japan, 〒102-0094 Tokyo, Chiyoda City, Kioicho, 1-3 東京ガーデンテラス 3F",
    "googlePlaceId": "ChIJHbq1qLiNGGARNlnd4lieF7I"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 29,
    "name": "102 House",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/102-house.html",
    "address": "506 The House of Roosevelt, No.27 Zhongshan East 1st Road, Shanghai"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 30,
    "name": "Naar",
    "city": "Kasauli",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Naar.html",
    "address": "VPO Darwa, sub tehsil kishangarh  Kasauli, District Solan  Himachal Pradesh 173206"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 31,
    "name": "Florilège",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/florilege.html",
    "address": "Japan, 〒105-0001 Tokyo, Minato City, Toranomon, 5 Chome−10−7",
    "googlePlaceId": "ChIJhU8r4Ba6JhUR2uFksk0mpCg"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 32,
    "name": "Estro",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/estro.html",
    "address": "2/F, 1 Duddell St, Central, Hong Kong"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 33,
    "name": "Myoujyaku",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/myoujyaku.html",
    "address": "Japan, 〒106-0031 Tokyo, Minato City, Nishiazabu, 3 Chome−2−34 B1F",
    "googlePlaceId": "ChIJxxsn3a-LGGARYqb5FTmUL98"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 34,
    "name": "Crony",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/crony.html",
    "address": "1 Chome-20-3 Higashiazabu, Minato City, Tokyo 106-0044, Japan"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 35,
    "name": "Caprice",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Caprice.html",
    "address": "Four Seasons Hotel, 8 Finance Street, Central, Hong Kong"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 36,
    "name": "Le Du",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Le-Du.html",
    "address": "399/3 Silom 7 Alley, Silom, Bang Rak, Bangkok 10500, Thailand",
    "googlePlaceId": "ChIJL7-My9KY4jARzlw1ffk9vo8"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 37,
    "name": "Narisawa",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Narisawa.html",
    "address": "Japan, 〒107-0062 Tokyo, Minato City, Minamiaoyama, 2 Chome−6−15",
    "googlePlaceId": "ChIJrbAVNIOMGGARXNvkApcqvng"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 38,
    "name": "Les Amis",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Les-amis.html",
    "address": "1 Scotts Rd, #01 - 16 Shaw Centre, Singapore 228208"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 39,
    "name": "Au Jardin",
    "city": "Penang",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Au-Jardin.html",
    "address": "The Warehouse @ Hin Bus Depot  125, Jalan Timah, 10150,  Georgetown, Penang, Malaysia"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 40,
    "name": "Labyrinth",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Labyrinth.html",
    "address": "8 Raffles Avenue, Downtown Core, Singapore, 039802"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 41,
    "name": "Mosu",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Mosu.html",
    "address": "4 Hoenamu-ro 41-gil, Yongsan District, Seoul"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 42,
    "name": "August",
    "city": "Jakarta",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/August.html",
    "address": "Sequis Tower - Ground Floor #03-02, Jl. Jenderal Sudirman No.Kav. 71, Jakarta, Jakarta 12190"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 43,
    "name": "Bium",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Bium.html",
    "address": "1F ,41, Hakdong-ro 97-gil, Gangnam-gu, Seoul"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 44,
    "name": "Locavore NXT",
    "city": "Ubud",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Locavore-NXT.html",
    "address": " Jl. A.A. Gede Rai Gang Pura Panti Bija, Lodtunduh, Kecamatan Ubud, Kabupaten Gianyar, Bali 80571, Ubud, Indonesia, Bali"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 45,
    "name": "Nae:Um",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Naeum.html",
    "address": "161 Telok Ayer St, Singapore 068615"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 46,
    "name": "Mono",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/mono.html",
    "address": "5/F, 18 On Lan Street Central, Hong Kong"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 47,
    "name": "Wana Yook",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/Wana-Yook.html",
    "address": "5, 15 Phaya Thai Rd, Thanon Phaya Thai, Ratchathewi, Bangkok 10400, Thailand"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 48,
    "name": "La Bourriche 133",
    "city": "Shanghai",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/La-Bourriche-133.html",
    "address": "No.133 Yuan Ming Yuan Road, YW103 (B) Ground Floor, Y.M.C.A Building, Shanghai, China"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 49,
    "name": "7th Door",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/7th-door.html",
    "address": "Seoul, Gangnam-gu, Hakdong-ro 97-gil, 41 4층"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 50,
    "name": "JL Studio",
    "city": "Taichung",
    "url": "https://www.the50.com/restaurants/best-in-asia/the-list/jl-studio.html",
    "address": "2nd F, No. 689, Yifeng Road, Section 4, Nantun District, Taichung, 408"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 51,
    "name": "Den",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 52,
    "name": "Chef 1996",
    "city": "Beijing",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 53,
    "name": "Baan Tepa",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 54,
    "name": "San",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 55,
    "name": "Solbam",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 56,
    "name": "Born and Bred",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 57,
    "name": "Alla Prima",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 58,
    "name": "Thevar",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 59,
    "name": "Burnt Ends",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 60,
    "name": "Goh",
    "city": "Fukuoka",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 61,
    "name": "Mume",
    "city": "Taipei",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 62,
    "name": "Dewakan",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 63,
    "name": "Sushi Shunji",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 64,
    "name": "Silks House",
    "city": "Taipei",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 65,
    "name": "Fumée",
    "city": "Shenzhen",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 66,
    "name": "Papa's",
    "city": "Mumbai",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 67,
    "name": "Samrub Samrub Thai",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 68,
    "name": "Ta Vie",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 69,
    "name": "Co-",
    "city": "Chengdu",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 70,
    "name": "Vea",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 71,
    "name": "Toyo Eatery",
    "city": "Manila",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 72,
    "name": "Sushi Saito",
    "city": "Tokyo",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 73,
    "name": "The Table",
    "city": "Mumbai",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 74,
    "name": "Soigné",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 75,
    "name": "Inja",
    "city": "New Delhi",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 76,
    "name": "Cenci",
    "city": "Kyoto",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 77,
    "name": "Meta",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 78,
    "name": "Peach Blossoms",
    "city": "Singapore",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 79,
    "name": "Ensue",
    "city": "Shenzhen",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 80,
    "name": "Jade Dragon",
    "city": "Macau",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 81,
    "name": "Villa Aida",
    "city": "Wakayama",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 82,
    "name": "Kataori",
    "city": "Kanazawa",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 83,
    "name": "Farmlore",
    "city": "Bengaluru",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 84,
    "name": "Xin Rong Ji (Xinyuan South Road)",
    "city": "Beijing",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 85,
    "name": "Jin Sha",
    "city": "Hangzhou",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 86,
    "name": "Anan Saigon",
    "city": "Ho Chi Minh City",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": "QPC3+M6Q, 89 Tôn Thất Đạm, Sài Gòn, Hồ Chí Minh 000000 베트남",
    "googlePlaceId": "ChIJZ_dpJ0EvdTER5wOl-TLvN-8"
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 87,
    "name": "Jungsik",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 88,
    "name": "Andō",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 89,
    "name": "Gēn",
    "city": "Penang",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 90,
    "name": "Amber",
    "city": "Hong Kong",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 91,
    "name": "Côte by Mauro Colagreco",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 92,
    "name": "Respiración",
    "city": "Kanazawa",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 93,
    "name": "Dewaya",
    "city": "Nishikawa",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 94,
    "name": "Ministry of Crab",
    "city": "Colombo",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 95,
    "name": "Gaa",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 96,
    "name": "Haoma",
    "city": "Bangkok",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 97,
    "name": "L'évo",
    "city": "Nanto",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 98,
    "name": "Kwonsooksoo",
    "city": "Seoul",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 99,
    "name": "Fiotto",
    "city": "Busan",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "asia",
    "year": 2026,
    "rank": 100,
    "name": "Celera",
    "city": "Makati City",
    "url": "https://www.the50.com/restaurants/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 1,
    "name": "El Chato",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/El-Chato.html",
    "address": "Calle 65 # 4-76, Chapinero Alto 110221, Bogotá, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 2,
    "name": "Kjolle",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Kjolle.html",
    "address": "Av. Pedro de Osma 301, Barranco,15063 Lima, Peru",
    "googlePlaceId": "ChIJr1L1USC3BZEREp0Z1sp3AeU"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 3,
    "name": "Don Julio",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Don-Julio.html",
    "address": "Guatemala 4691, Palermo Viejo, Buenos Aires, Argentina",
    "googlePlaceId": "ChIJoYl36oa1vJURWWhqD9z3UV8"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 4,
    "name": "Mérito",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Mérito.html",
    "address": "Av. 28 de Julio 206, Barranco, Lima, 15063, Peru",
    "googlePlaceId": "ChIJJW2CECq3BZER0acewjEiZZ8"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 5,
    "name": "Celele",
    "city": "Cartagena",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Celele.html",
    "address": "Calle del Espiritu Santo, cr 10c # 29 – 200, Getsemaní, Cartagena, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 6,
    "name": "Boragó",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Boragó.html",
    "address": "San José María Escrivá de Balaguer 5970, Región Metropolitana, Santiago, 7640804, Chile",
    "googlePlaceId": "ChIJxSErG0jPYpYRoyEeWBQK0Dk"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 7,
    "name": "Quintonil",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Quintonil.html",
    "address": "Newton 55, Polanco, 11560, Mexico City, Mexico",
    "googlePlaceId": "ChIJbS8EZf8B0oURwwD8B0MpqK0"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 8,
    "name": "Tuju",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/tuju.html",
    "address": "R. Frei Galvão, 135 - Jardim Paulistano, São Paulo - SP, 01454-060"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 9,
    "name": "Cosme",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/cosme.html",
    "address": "Av. Tudela y Varela 162, San Isidro 15073, Peru"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 10,
    "name": "Nuema",
    "city": "Quito",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/nuema.html",
    "address": "Bello Horizonte E11-12 y, Quito 170517, Ecuador"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 11,
    "name": "Mayta",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Mayta.html",
    "address": "Av. Mariscal La Mar 1285, Miraflores 15027, Peru",
    "googlePlaceId": "ChIJqz8RPjbIBZERTyuxNQ8LNHs"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 12,
    "name": "Nelita",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/nelita.html",
    "address": "R. Ferreira de Araújo, 330 - Pinheiros, São Paulo, 05428-000, Brazil"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 13,
    "name": "Lasai",
    "city": "Rio de Janeiro",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Lasai.html",
    "address": "Largo dos Leões 35, Humaitá Rio de Janeiro / RJ – 22260-210",
    "googlePlaceId": "ChIJhWl8Qd5_mQAR-xc4FQjSFaQ"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 14,
    "name": "Casa Las Cujas",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/casa-las-cujas.html",
    "address": "Alonso de Córdova 2467, Vitacura, Santiago, 7630418"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 15,
    "name": "Alcalde",
    "city": "Guadalajara",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Alcalde.html",
    "address": "Av. México 2903, Vallarta Nte., 44690 Guadalajara, Jal., Mexico"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 16,
    "name": "Villa Torél",
    "city": "Ensenada",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Villa-Torél.html",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 17,
    "name": "Fauna",
    "city": "Valle de Guadalupe",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/fauna.html",
    "address": "México 3 km #73, 22760 Francisco Zarco, Valle de Guadalupe, Mexico"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 18,
    "name": "Maito",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/maito.html",
    "address": "C. 50, Panamá, Provincia de Panamá, Panama"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 19,
    "name": "Sublime",
    "city": "Guatemala City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/sublime.html",
    "address": "12 Calle 4-15, Guatemala City 01014, Guatemala"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 20,
    "name": "Evvai",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/evvai.html",
    "address": "Rua Joaquim Antunes 108, São Paulo, Brazil"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 21,
    "name": "Niño Gordo",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Nino-Gordo.html",
    "address": "Thames 1810, C1414DDL C1414DDL, Cdad. Autónoma de Buenos Aires, Argentina"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 22,
    "name": "Arca",
    "city": "Tulum",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/arca.html",
    "address": "Carr. Tulum-Boca Paila km 7.6, Tulum Beach, 77780 Tulum, Q.R., Mexico"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 23,
    "name": "Leo",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/leo.html",
    "address": "Cl. 65 Bis #4-23, Bogotá, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 24,
    "name": "El Preferido de Palermo",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/El-Preferido-de-Palermo.html",
    "address": "Jorge Luis Borges 2108, C1425 FFD, Buenos Aires, Argentina"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 25,
    "name": "A Casa do Porco",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/a-casa-do-porco.html",
    "address": "Rua Araújo, nº 124 Centro, São Paulo, Brazil"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 26,
    "name": "La Mar",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/la-mar.html",
    "address": "Av. Mariscal La Mar 770, Miraflores 15074, Peru"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 27,
    "name": "El Mercado",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/el-mercado.html",
    "address": "Martha Salotti 445 Buenos Aires, C1107CMB"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 28,
    "name": "Yum Cha",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/yum-cha.html",
    "address": "La Herradura 2722, Providencia, Santiago, 7530001"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 29,
    "name": "Cordero",
    "city": "Caracas",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Cordero.html",
    "address": "Av Principal de las Mercedes CC Tolon Fashion Mall, Las Mercedes, Caracas"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 30,
    "name": "Máximo",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Máximo.html",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 31,
    "name": "Demo Magnolia",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/demo-magnolia.html",
    "address": "Hotel Magnolia, Huérfanos 539, Santiago, Región Metropolitana, Chile"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 32,
    "name": "Huniik",
    "city": "Mérida",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Huniik.html",
    "address": "Calle 60 No.415-B entre Calle 45 y Calle 47, Centro, 97000 Mérida, Yuc., Mexico"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 33,
    "name": "Rafael",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/rafael.html",
    "address": "Ca. San Martín 300, Miraflores 15074, Peru"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 34,
    "name": "Afluente",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/afluente.html",
    "address": "Kr 3a 57-35 Chapinero Alto, Bogotá, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 35,
    "name": "Aramburu",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/aramburu.html",
    "address": "Pasaje del Correo, Vicente López 1661, C1103ACY Cdad. Autónoma de Buenos Aires, Argentina"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 36,
    "name": "Trescha",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Trescha.html",
    "address": "Murillo 725, C1414 Cdad. Autónoma de Buenos Aires, Argentina"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 37,
    "name": "Diacá",
    "city": "Guatemala City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Diacá.html",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 38,
    "name": "Oteque",
    "city": "Rio de Janeiro",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/oteque.html",
    "address": "Rua Conde de Irajá, 581 - Botafogo, Rio de Janeiro - RJ, 22271-020"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 39,
    "name": "Rosetta",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Rosetta.html",
    "address": "Colima 166, Colonia Roma Norte 06700, Mexico City, Mexico",
    "googlePlaceId": "ChIJdSGAWgP_0YURwNtY7rftf2E"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 40,
    "name": "Crizia",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Crizia.html",
    "address": "Fitz Roy 1819, Palermo Hollywood, Buenos Aires"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 41,
    "name": "Humo Negro",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/humo-negro.html",
    "address": "Cra. 5 #56-06, Chapinero, Bogotá, DC, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 42,
    "name": "Mercado 24",
    "city": "Guatemala City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Mercado-24.html",
    "address": "Via 5 2-24, Cdad. de Guatemala, Guatemala"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 43,
    "name": "Sikwa",
    "city": "San José",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/sikwa.html",
    "address": "C. 41, Los Yoses, San José, Costa Rica"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 44,
    "name": "Osso",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Osso.html",
    "address": "Av. Santo Toribio 173, San Isidro, Peru"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 45,
    "name": "Karai by Mitsuharu",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/karai-by-mitsuharu.html",
    "address": "Isidora Goyenechea 3000, Las Condes, Chile 7550653"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 46,
    "name": "Manuel",
    "city": "Barranquilla",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/manuel.html",
    "address": "Cra. 55 #74-125, Nte. Centro Historico, Barranquilla, Atlántico, Colombia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 47,
    "name": "Cantina del Tigre",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/cantina-del-tigre.html",
    "address": "Plaza Centenario, C. 68 Este, Panamá, Panama"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 48,
    "name": "Arami",
    "city": "La Paz",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/arami.html",
    "address": "Av. Aviador 77, La Paz, Bolivia"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 49,
    "name": "Mil",
    "city": "Moray",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/Mil.html",
    "address": "Vía a Moray, Maras 08655, Peru"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 50,
    "name": "Julia",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/the-list/julia.html",
    "address": "Loyola 807, C1414 C1414AUQ, Cdad. Autónoma de Buenos Aires, Argentina"
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 51,
    "name": "Pujol",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 52,
    "name": "Origem",
    "city": "Salvador",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 53,
    "name": "Conservatorium",
    "city": "San José",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 54,
    "name": "Cara de Vaca",
    "city": "Monterrey",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 55,
    "name": "Kotori",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 56,
    "name": "Metzi",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 57,
    "name": "La Calma by Fredes",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 58,
    "name": "Le Chique",
    "city": "Cancún",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 59,
    "name": "Sud 777",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 60,
    "name": "Clara",
    "city": "Quito",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 61,
    "name": "La Tapa Del Coco",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 62,
    "name": "Shizen",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 63,
    "name": "Pulpería Santa Elvira",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 64,
    "name": "Ness",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 65,
    "name": "Oseille",
    "city": "Rio de Janeiro",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 66,
    "name": "Clon",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 67,
    "name": "Maní",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 68,
    "name": "Tributo",
    "city": "Quito",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 69,
    "name": "Mishiguene",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 70,
    "name": "Gran Dabbang",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 71,
    "name": "Em",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 72,
    "name": "Umi",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 73,
    "name": "Cepa",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 74,
    "name": "D.O.M.",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 75,
    "name": "Gustu",
    "city": "La Paz",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 76,
    "name": "Oda",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 77,
    "name": "Alo's",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 78,
    "name": "El Papagayo",
    "city": "Córdoba",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 79,
    "name": "Ancestral",
    "city": "La Paz",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 80,
    "name": "Manu",
    "city": "Curitiba",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 81,
    "name": "Astrid y Gastón",
    "city": "Lima",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 82,
    "name": "Fonda Lo Que Hay",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 83,
    "name": "Parador La Huella",
    "city": "José Ignacio",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 84,
    "name": "Nicos",
    "city": "Mexico City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 85,
    "name": "Debora",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 86,
    "name": "Manzanar",
    "city": "Montevideo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 87,
    "name": "El Xolo",
    "city": "San Salvador",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 88,
    "name": "Aguají",
    "city": "Sosúa",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 89,
    "name": "La Casa Bistró",
    "city": "Caracas",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 90,
    "name": "Lunario",
    "city": "Valle de Guadalupe",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 91,
    "name": "Caleta",
    "city": "Panama City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 92,
    "name": "Lo de Tere",
    "city": "Punta del Este",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 93,
    "name": "Notiê",
    "city": "São Paulo",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 94,
    "name": "Ana",
    "city": "Guatemala City",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 95,
    "name": "Demencia",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 96,
    "name": "Selma",
    "city": "Bogotá",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 97,
    "name": "Azafrán",
    "city": "Mendoza",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 98,
    "name": "Sambombi Bistró Local",
    "city": "Medellin",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 99,
    "name": "Restaurante Manga",
    "city": "Salvador",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "latin-america",
    "year": 2025,
    "rank": 100,
    "name": "Fukasawa",
    "city": "Santiago",
    "url": "https://www.the50.com/restaurants/best-in-latin-america/list/51-100",
    "address": ""
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 1,
    "name": "Khufu's",
    "city": "Giza",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Khufus.html",
    "address": "X4HF+8P, Nazlet El-Semman, Al Haram, Giza Governorate 12512, Egypt"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 2,
    "name": "Kinoya",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Kinoya.html",
    "address": "The Onyx Tower 2, Floor P2, Dubai, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 3,
    "name": "Trèsind Studio",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Tresind-Studio.html",
    "address": "St. Regis Gardens Entrance B - The Palm Jumeirah - Dubai",
    "googlePlaceId": "ChIJcfzwzo0TXz4RyQpaHkMBWsE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 4,
    "name": "Orfali Bros",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/orfali-bros-bistro.html",
    "address": "D92 - Jumeirah - Jumeirah 1 - Dubai - United Arab Emirates",
    "googlePlaceId": "ChIJv6Zm1-hDXz4R9c0k9cOGun4"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 5,
    "name": "Beihouse",
    "city": "Beirut",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Beihouse.html",
    "address": "Beihouse, Pasteur Street, Beirut, Lebanon"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 6,
    "name": "Kuuru",
    "city": "Jeddah",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Kuuru.html",
    "address": "Al Malik Road, Al Khalidiyyah, Jeddah 23422, Saudi Arabia"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 7,
    "name": "Sufret Maryam",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Sufret-Maryam.html",
    "address": "Wasl 51 – Jumeirah – Jumeirah 1 – Dubai"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 8,
    "name": "Jun's",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Juns.html",
    "address": "Sheikh Mohammed bin Rashid Blvd - Downtown Dubai - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 9,
    "name": "Manao",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Manao.html",
    "address": "Wasl Vita Mall, Jumeirah 1, Dubai, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 10,
    "name": "Moonrise",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Moonrise.html",
    "address": "Eden House - Al Satwa - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 11,
    "name": "Table 3",
    "city": "Casablanca",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Table-3.html",
    "address": " 4 Av. de la Côte d'Emeraude, Casablanca"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 12,
    "name": "Marble",
    "city": "Riyadh",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Marble.html",
    "address": "Turki Square, Makkah Al Mukarramah Br Rd, Umm Al Hamam Al Sharqi, Riyadh 12321, Saudi Arabia"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 13,
    "name": "Em Sherif",
    "city": "Beirut",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Em-Sherif.html",
    "address": "Damascus Street, Monot Beirut, Lebanon"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 14,
    "name": "11 Woodfire",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/11-Woodfire.html",
    "address": "Villa 11 75B St, Jumeirah, Jumeirah 1, Dubai, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 15,
    "name": "Kokoro",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Kokoro.html",
    "address": "Al Serkal Avenue 17th St - Al Quoz, Dubai"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 16,
    "name": "Marmellata Bakery",
    "city": "Abu Dhabi",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Marmellata-Bakery.html",
    "address": "Zayed Port - Freezone 2 - Abu Dhabi - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 17,
    "name": "3 Fils Dubai",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/3-Fils.html",
    "address": "Jumeirah Fishing Harbour - Shop 02 - 1 Al Urouba St - Jumeirah 2 - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 18,
    "name": "Cantina",
    "city": "Kuwait City",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Cantina.html",
    "address": "Street 28, Shuwaikh Industrial, Kuwait"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 19,
    "name": "La Grande Table Marocaine",
    "city": "Marrakech",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/La-Grande-Table-Marocaine.html",
    "address": "Rue Abou El Abbas Sebti, Marrakesh 40000, Morocco"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 20,
    "name": "Reif Kushiyaki Cairo",
    "city": "Cairo",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Reif-Kushiyaki-Cairo.html",
    "address": " 5A By The Waterway Developments, New Cairo 3, Cairo Governorate 4720113, Egypt"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 21,
    "name": "Le Petit Cornichon",
    "city": "Marrakech",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Le-Petit-Cornichon.html",
    "address": "27 Rue Moulay Ali, Marrakech"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 22,
    "name": "FZN",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/FZN.html",
    "address": "Atlantis The Palm, Crescent Road, The Palm Jumeirah, Dubai"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 23,
    "name": "TakaHisa",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/TakaHisa.html",
    "address": "Banyan Tree Dubai - First Floor - Bluewaters Island - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 24,
    "name": "Sesamo",
    "city": "Marrakech",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Sesamo.html",
    "address": "Royal Mansour, El Sebti, Rue Abou Al Abbas, Marrakesh 40000, Morocco"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 25,
    "name": "Kazoku",
    "city": "Cairo",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Kazoku.html",
    "address": "Swan Lake Compound, Second New Cairo, Cairo Governorate 4732401, Egypt"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 26,
    "name": "Shams El Balad",
    "city": "Amman",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Shams-El-Balad.html",
    "address": "Mu'Ath Bin Jabal Street 69, Amman 11181, Jordan"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 27,
    "name": "LPM Dubai",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/LPM-Dubai.html",
    "address": "Gate Village No, 8, DIFC, Dubai, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 28,
    "name": "Alee",
    "city": "Amman",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Alee.html",
    "address": "Building number 44, Jabal Amman ,First Circle, Othman Ben Affan St., Amman 00962, Jordan"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 29,
    "name": "Three Bros",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Three-Bros.html",
    "address": "Al Wasl 51, Dubai United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 30,
    "name": "Dara Dining by Sara Aqel",
    "city": "Amman",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Dara-Dining-by-Sara-Aqel.html",
    "address": "Al-Mutanabbi St. 46, Amman 11183, Jordan"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 31,
    "name": "+61",
    "city": "Marrakech",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/-61.html",
    "address": "96 Rue Mohammed el Beqal, Marrakech 40000, Morocco"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 32,
    "name": "Zooba (Zamalek)",
    "city": "Cairo",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Zooba-Zamalek.html",
    "address": "16 26 July St, Al Gabalayah, Zamalek, Giza Governorate 4270123, Egypt"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 33,
    "name": "Gaia",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Gaia.html",
    "address": "Dubai International Financial Centre, Gate Village No. 4, Dubai, United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 34,
    "name": "Zuma",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Zuma.html",
    "address": "Podium Level, Gate Village, Building 3 - 06 Al Mustaqbal St - Trade Centre - DIFC - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 35,
    "name": "Mimi Kakushi",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Mimi-Kakushi.html",
    "address": "Four Seasons Resort - 23A St - Jumeirah - Jumeirah 2 - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 36,
    "name": "Row on 45",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Row-on-45.html",
    "address": "Al Emreef St - Dubai Marina - Dubai - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 37,
    "name": "Sachi Cairo",
    "city": "Cairo",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Sachi-Cairo.html",
    "address": "3, Cleopatra St, Korba،El-Montaza, Heliopolis, Cairo Governorate, Egypt"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 38,
    "name": "Niri",
    "city": "Abu Dhabi",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Niri.html",
    "address": "Mamsha Al Saadiyat - Al Saadiyat Island - SDN1 - Abu Dhabi - United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 39,
    "name": "Buco",
    "city": "Beirut",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Buco.html",
    "address": "Gouraud, Beirut, Lebanon"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 40,
    "name": "Chez Wam",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Chez-Wam.html",
    "address": "St Regis Gardens, The Palm Jumeirah, Dubai, United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 41,
    "name": "Boca",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Boca.html",
    "address": "Gate Village 6, DIFC, Dubai, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 42,
    "name": "3 Fils Abu Dhabi",
    "city": "Abu Dhabi",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/3-Fils-Abu-Dhabi.html",
    "address": "Al Bateen, W35, Abu Dhabi, United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 43,
    "name": "Girl and the Goose",
    "city": "Dubai",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Girl-and-the-Goose.html",
    "address": "Anantara Downtown Hotel, Business Bay, Dubai, United Arab Emirates"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 44,
    "name": "Idam by Alain Ducasse",
    "city": "Doha",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Idam.html",
    "address": "Museum of Islamic Art, 5th Floor, Corniche Promenade, Doha, Qatar"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 45,
    "name": "Myazu",
    "city": "Riyadh",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Myazu.html",
    "address": "Musad Bin Jalawi, As Sulimaniyah, Riyadh 12244, Saudi Arabia"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 46,
    "name": "Le Golfe",
    "city": "La Marsa",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Le-Golfe.html",
    "address": "5 Rue Larbi Zarrouk, Tunis, Tunisia"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 47,
    "name": "LPM Abu Dhabi",
    "city": "Abu Dhabi",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/LPM-Abu-Dhabi.html",
    "address": "The Galleria, Al Maryah Island, Abu Dhabi Global Market Square, Abu Dhabi, UAE"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 48,
    "name": "Lyra",
    "city": "Manama",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Lyra.html",
    "address": "Building 176, Road 6403, Diyar 973, Bahrain"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 49,
    "name": "Farmers",
    "city": "Marrakech",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Farmers.html",
    "address": "96 Rue Mohammed el Beqal, Marrakech 40000, Morocco"
  },
  {
    "kind": "restaurants",
    "scope": "middle-east-and-north-africa",
    "year": 2026,
    "rank": 50,
    "name": "Matbakhi",
    "city": "Kuwait City",
    "url": "https://www.the50.com/restaurants/best-in-middle-east-and-north-africa/the-list/Matbakhi.html",
    "address": "Avenues Mall, Sheikh Zayed Bin Sultan Al Nahyan Road, Surra 03000, Kuwait"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 1,
    "name": "Smyth",
    "city": "Chicago",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/smyth.html",
    "address": "177 North Ada St. 101, Chicago, IL 60607, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 2,
    "name": "Eight",
    "city": "Calgary",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/eight.html",
    "address": "631 Confluence Way SE, Calgary, AB T2G 1C3, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 3,
    "name": "Restaurant Pearl Morissette",
    "city": "Lincoln",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/restaurant-pearl-morissette.html",
    "address": "3953 Jordan Rd. Jordan Station, ON L0R 1S0, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 4,
    "name": "Dakar NOLA",
    "city": "New Orleans",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/dakar-nola.html",
    "address": "937 Leonidas Street, New Orleans, LA 70118"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 5,
    "name": "Mon Lapin",
    "city": "Montreal",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/mon-lapin.html",
    "address": "150 Rue Saint-Zotique Est, Montreal, QC H2S 1L8, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 6,
    "name": "Albi",
    "city": "Washington DC",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/albi.html",
    "address": "1346 4th St. SE. Washington, DC 20003, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 7,
    "name": "Atomix",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/atomix.html",
    "address": "104 E. 30th St. New York, NY 10016, USA",
    "googlePlaceId": "ChIJ3bmAHghZwokRRXYO57yLuss"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 8,
    "name": "Quetzal",
    "city": "Toronto",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/quetzal.html",
    "address": "419 College St. Kensington Market, Toronto, ON, M5T 1T1"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 9,
    "name": "Tanière3",
    "city": "Quebec City",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/taniere3.html",
    "address": "7 Rue du Don-de-Dieu, Québec, QC G1K 3Z6, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 10,
    "name": "César",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/cesar.html",
    "address": "333 Hudson St. New York, NY 10013, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 11,
    "name": "Kalaya",
    "city": "Philadelphia",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/kalaya.html",
    "address": "4 West Palmer St. Philadelphia, PA 19125, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 12,
    "name": "Le Veau d'Or",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/le-veau-dor.html",
    "address": "129 E. 60th St. New York, NY 10022, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 13,
    "name": "Le Bernardin",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/le-bernadin.html",
    "address": "155 W. 51st St. New York, NY 10019, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 14,
    "name": "Kabawa",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/kabawa.html",
    "address": "8 Extra Pl, New York, NY 10003, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 15,
    "name": "Le Violon",
    "city": "Montreal",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/le-violon.html",
    "address": "4720 Rue Marquette, Montreal, QC H2J 3Y6, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 16,
    "name": "SingleThread",
    "city": "Healdsburg",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/singlethread.html",
    "address": "131 North St. Healdsburg, CA 95448, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 17,
    "name": "Published on Main",
    "city": "Vancouver",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/published-on-main.html",
    "address": "3593 Main St. Vancouver, BC V5V 3N4, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 18,
    "name": "Jungsik",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/jungsik.html",
    "address": "2 Harrison St. New York, NY 10013, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 19,
    "name": "Penny",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/penny.html",
    "address": "90 E. 10th St. 1st Floor, New York, NY 10003, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 20,
    "name": "Emeril's",
    "city": "New Orleans",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/emerils.html",
    "address": "800 Tchoupitoulas St. New Orleans, LA 70130, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 21,
    "name": "Chubby Fish",
    "city": "Charleston",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/chubby-fish.html",
    "address": "252 Coming St. Charleston, SC 29403, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 22,
    "name": "Saison",
    "city": "San Francisco",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/saison.html",
    "address": "178 Townsend St. San Francisco, CA 94107, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 23,
    "name": "Aska",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/aska.html",
    "address": "47 S. 5th St. Brooklyn, NY 11249, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 24,
    "name": "Moon Rabbit",
    "city": "Washington DC",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/moon-rabbit.html",
    "address": "927 F. St. NW, Washington, DC 20004, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 25,
    "name": "Edulis",
    "city": "Toronto",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/edulis.html",
    "address": "169 Niagara St. Toronto, Ontario"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 26,
    "name": "Holbox",
    "city": "Los Angeles",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/holbox.html",
    "address": "Mercado La Paloma, 3655 S. Grand Ave. c9, Los Angeles, CA 90007, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 27,
    "name": "Beba",
    "city": "Montreal",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/beba.html",
    "address": "3900 Rue Éthel, Verdun, QC H4G 1S4, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 28,
    "name": "Mhel",
    "city": "Toronto",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/mhel.html",
    "address": "276 Havelock St. Toronto, ON M6H 3B9, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 29,
    "name": "Avize",
    "city": "Atlanta",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/avize.html",
    "address": "956 Brady Ave. NW Atlanta, GA 30318"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 30,
    "name": "Acamaya",
    "city": "New Orleans",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/acamaya.html",
    "address": "3070 Dauphine St. New Orleans, LA 70117"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 31,
    "name": "Addison by William Bradley",
    "city": "San Diego",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Addison-by-William-Bradley.html",
    "address": " 5200 Grand Del Mar Way, San Diego, CA 92130, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 32,
    "name": "Providence",
    "city": "Los Angeles",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/providence.html",
    "address": "5955 Melrose Ave. Los Angeles, CA 90038, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 33,
    "name": "Benu",
    "city": "San Francisco",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/benu.html",
    "address": "22 Hawthorne St. San Francisco, CA 94105, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 34,
    "name": "Sabayon",
    "city": "Montreal",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/sabayon.html",
    "address": "2194 Rue Centre, Montreal, QC H3K 1J4, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 35,
    "name": "AnnaLena",
    "city": "Vancouver",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/annalena.html",
    "address": "1809 W 1st Ave. Vancouver, BC V6J 4M6, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 36,
    "name": "Corima",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/corima.html",
    "address": "3 Allen St. New York, NY 10002, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 37,
    "name": "Dōgon by Kwame Onwuachi",
    "city": "Washington DC",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/dogon.html",
    "address": "1330 Maryland Ave. SW. Washington, DC 20024, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 38,
    "name": "Torrisi",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Torrisi.html",
    "address": "275 Mulberry St. New York, NY 10012, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 39,
    "name": "Tatiana by Kwame Onwuachi",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Tatiana-by-Kwame-Onwuachi.html",
    "address": "10 Lincoln Center Plaza, New York, NY 10023, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 40,
    "name": "Friday Saturday Sunday",
    "city": "Philadelphia",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/friday-saturday-sunday.html",
    "address": "261 S. 21st St. Philadelphia, PA 19103, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 41,
    "name": "Semma",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Semma.html",
    "address": "60 Greenwich Ave, New York, NY 10011, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 42,
    "name": "Pascual",
    "city": "Washington DC",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/pascual.html",
    "address": "732 Maryland Ave NE. Washington, DC 20002, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 43,
    "name": "Gramercy Tavern",
    "city": "New York",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Gramercy-Tavern.html",
    "address": "42 E 20th St. New York, NY 10003, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 44,
    "name": "Atelier Crenn",
    "city": "San Francisco",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/atelier-crenn.html",
    "address": "3127 Fillmore St. San Francisco, CA 94123, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 45,
    "name": "Sons & Daughters",
    "city": "San Francisco",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Sons-Daughters.html",
    "address": "2875 18th St. San Francisco, CA 94110, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 46,
    "name": "Somni",
    "city": "Los Angeles",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/somni.html",
    "address": "9045 Nemo St. West Hollywood, CA 90069, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 47,
    "name": "Wild Blue",
    "city": "Whistler",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/wild-ble.html",
    "address": "4005 Whistler Way, Whistler, BC V8B 1J1, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 48,
    "name": "The Pine",
    "city": "Collingwood",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/The-Pine.html",
    "address": "7535 County Rd 9, Creemore, ON L0M 1G0, Canada"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 49,
    "name": "Kato",
    "city": "Los Angeles",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/kato.html",
    "address": "777 S. Alameda St. Building 1, Suite 114, Los Angeles, CA 90021, United States"
  },
  {
    "kind": "restaurants",
    "scope": "north-america",
    "year": 2026,
    "rank": 50,
    "name": "Diane's Place",
    "city": "Minneapolis",
    "url": "https://www.the50.com/restaurants/best-in-north-america/the-list/Dianes-Place.html",
    "address": "117 14th Ave NE. Minneapolis, MN 55413, United States"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 1,
    "name": "Bar Leone",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/bar-leone.html",
    "address": "15 Bridges St, Central, Hong Kong",
    "googlePlaceId": "ChIJqyyPsGUBBDQRE5twNod5Lk8"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 2,
    "name": "Handshake Speakeasy",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/handshake-speakeasy.html",
    "address": "C. Amberes 65, Juárez, Cuauhtémoc, 06600 Mexico City, Mexico",
    "googlePlaceId": "ChIJU_vg0kID0oUR37k2I3XazcM"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 3,
    "name": "Sips",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/sips.html",
    "address": "C/ de Muntaner, 108, 08036 Barcelona, Spain",
    "googlePlaceId": "ChIJVeGtVgijpBIRGhWNVpFekW0"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 4,
    "name": "Paradiso",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/paradiso.html",
    "address": "Carrer de Rera Palau, 4, 08003 Barcelona, Spain",
    "googlePlaceId": "ChIJUxwdO_6ipBIRdMGRVDsolaM"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 5,
    "name": "Tayēr + Elementary",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/tayer-elementary.html",
    "address": "152 Old St, London EC1V 9BW, UK",
    "googlePlaceId": "ChIJP72YPh8ddkgRHAMOeJp_gEI"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 6,
    "name": "Connaught Bar",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/connaught-bar.html",
    "address": "Connaught, Carlos Pl, London W1K 2A, UK",
    "googlePlaceId": "ChIJ0aqjLCwFdkgRsvmYeG290jE"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 7,
    "name": "Moebius Milano",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/moebius-milano.html",
    "address": "Via Alfredo Cappellini, 25, 20124 Milano MI, Italy",
    "googlePlaceId": "ChIJSVm3PfbHhkcRPeDWzSh9BS8"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 8,
    "name": "Line",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/line.html",
    "address": "Agathodemonos 37, Orestou 1, 118 53 Athens, Greece",
    "googlePlaceId": "ChIJ13n7hoG9oRQRXHgFVrMGEGU"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 9,
    "name": "Jigger & Pony",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/jigger-pony.html",
    "address": "165 Tg Pagar Rd, Amara Hotel, Singapore 088539",
    "googlePlaceId": "ChIJ36AdBg0Z2jERvFl0QFoqZ0E"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 10,
    "name": "Tres Monos",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/tres-monos.html",
    "address": "Guatemala 4899, C1425 Buenos Aires, Argentina",
    "googlePlaceId": "ChIJo7CuuHu1vJUR9DoRRpMQDNs"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 11,
    "name": "Alquímico",
    "city": "Cartagena",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/alquimico.html",
    "address": "Cl. del Colegio #34-24, Cartagena de Indias, Colombia",
    "googlePlaceId": "ChIJ7zMvlZ8v9o4RWCwfENTkEbc"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 12,
    "name": "Superbueno",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/superbueno.html",
    "address": "13 1st Ave., New York, NY 10003",
    "googlePlaceId": "ChIJbXN71WhZwokRNTk55-ScVWY"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 13,
    "name": "Lady Bee",
    "city": "Lima",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/lady-bee.html",
    "address": "Av. Ernesto Diez Canseco 329, Miraflores 15074, Peru",
    "googlePlaceId": "ChIJs8cSpRzJBZERvexurL1NP1M"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 14,
    "name": "Himkok",
    "city": "Oslo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/himkok.html",
    "address": "Storgata 27, 0184 Oslo, Norway",
    "googlePlaceId": "ChIJUyV7KGJuQUYRohEJQ-fnslw"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 15,
    "name": "Bar Us",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/bar-us.html",
    "address": "1/37 Floor, 1 Soi Sukhumvit 26, Khlong Tan, Khlong Toei, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJG5QaZUKf4jARMm-GbfMbX4A"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 16,
    "name": "Zest",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/zest.html",
    "address": "B1 26 KR 55 Dosan-daero 55-gil, Gangnam-gu, Seoul, Korea",
    "googlePlaceId": "ChIJ9eN6-_GlfDUR5SGWDB7YNkw"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 17,
    "name": "Bar Nouveau",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/bar-nouveau.html",
    "address": "5 Rue des Haudriettes, 75003 Paris, France",
    "googlePlaceId": "ChIJ4YqD5chv5kcRf4-j_pVUvnc"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 18,
    "name": "Bar Benfiddich",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/bar-benfiddich.html",
    "address": "9F, 1 Chome-13-7, Nishishinjuku, Shinjuku City, 160-0023 Tokyo, Japan",
    "googlePlaceId": "ChIJZUTGW9GMGGAROJ7G4sU221Q"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 19,
    "name": "Caretaker's Cottage",
    "city": "Melbourne",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/caretakers-cottage.html",
    "address": "139-141 Little Lonsdale St, Melbourne VIC 3000, Australia",
    "googlePlaceId": "ChIJI_RgtUND1moRnACbclQN7Bg"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 20,
    "name": "The Cambridge Public House",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/the-cambridge-public-house.html",
    "address": "8 Rue de Poitou, 75003 Paris, France",
    "googlePlaceId": "ChIJf1PlS6hv5kcRfxnt_fDSpyE"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 21,
    "name": "Satan's Whiskers",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/satans-whiskers.html",
    "address": "343 Cambridge Heath Rd, London E2 9RA, UK",
    "googlePlaceId": "ChIJf9GjdNscdkgRPi-9Fxb6iDo"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 22,
    "name": "Locale Firenze",
    "city": "Florence",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/locale-firenze.html",
    "address": "Via delle Seggiole, 12r, 50122 Florence, Italy",
    "googlePlaceId": "ChIJg0T1mgZUKhMRp59MjreQ_7w"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 23,
    "name": "Tlecān",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/tlecan.html",
    "address": "Av. Álvaro Obregón 228-Local 2, Roma Nte., Cuauhtémoc, 06700 Ciudad de México, CDMX, Mexico",
    "googlePlaceId": "ChIJRbtqqOX_0YURJkwQEFZd2cs"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 24,
    "name": "Tan Tan",
    "city": "São Paulo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/tan-tan.html",
    "address": "R. Fradique Coutinho, 153 - Pinheiros, São Paulo - SP, 05416-010, Brazil",
    "googlePlaceId": "ChIJkzzWB55XzpQRiqS5LxkAxrU"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 25,
    "name": "Mirror Bar",
    "city": "Bratislava",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/mirror-bar.html",
    "address": "Radisson Blu Carlton Hotel, Bratislava, Hviezdoslavovo námestie 3, 811 02 Bratislava, Slovakia",
    "googlePlaceId": "ChIJDWebZPGJbEcRFar4JUg0LkY"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 26,
    "name": "CoChinChina",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/cochinchina.html",
    "address": "Armenia 1540, C1414 Buenos Aires, Argentina",
    "googlePlaceId": "ChIJs2XPmoG1vJURwboMb5sigY0"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 27,
    "name": "Baba au Rum",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/baba-au-rum.html",
    "address": "Klitiou 6, 105 60 Athens, Greece",
    "googlePlaceId": "ChIJFVsBjjy9oRQR7XnarON2k94"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 28,
    "name": "Nouvelle Vague",
    "city": "Tirana",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/nouvelle-vague.html",
    "address": "Rruga Pjetër Bogdani, Tiranë, Albania",
    "googlePlaceId": "ChIJwUqyygMxUBMRSclrxBuvLqQ"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 29,
    "name": "Hope & Sesame",
    "city": "Guangzhou",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/hope-sesame.html",
    "address": "Miaoqian Xijie 58, Guangzhou"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 30,
    "name": "Danico",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/danico.html",
    "address": "6 Rue Vivienne, 75002 Paris, France",
    "googlePlaceId": "ChIJP-sdWztu5kcRmKJqBJVhzfw"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 31,
    "name": "Scarfes Bar",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/scarfes-bar.html",
    "address": "Rosewood London, 252 High Holborn, London WC1V 7EN, UK",
    "googlePlaceId": "ChIJi-8-gTUbdkgRlnM1J18fB24"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 32,
    "name": "Svanen",
    "city": "Oslo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/svanen.html",
    "address": "Karl Johans gt. 13, 0154 Oslo, Norway",
    "googlePlaceId": "ChIJD_-Fb2pvQUYRjcMxOgNFm2c"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 33,
    "name": "Sastrería Martinez",
    "city": "Lima",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/sastreria-martinez.html",
    "address": "Av. Mariscal La Mar 1263, Miraflores 15074, Peru",
    "googlePlaceId": "ChIJ8bX9J3zJBZERYAhk9qKJ8aw"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 34,
    "name": "Panda & Sons",
    "city": "Edinburgh",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/panda-sons.html",
    "address": "79 Queen St, Edinburgh EH2 4NF, UK",
    "googlePlaceId": "ChIJc8uwh73Hh0gRUxs-kdJ18DU"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 35,
    "name": "Röda Huset",
    "city": "Stockholm",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/roda-huset.html",
    "address": "Malmskillnadsgatan 9, 111 57 Stockholm, Sweden",
    "googlePlaceId": "ChIJD9TAUaGdX0YRiCmb4VoK9gY"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 36,
    "name": "Mimi Kakushi",
    "city": "Dubai",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/mimi-kakushi.html",
    "address": "Four Seasons Resort, 23A St, Jumeirah, Jumeirah 2, Dubai, UAE",
    "googlePlaceId": "ChIJj-ySLalDXz4RLvs4jx1IGfo"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 37,
    "name": "Salmon Guru",
    "city": "Madrid",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/salmon-guru.html",
    "address": "Calle de Echegaray, 21, 28014 Madrid, Spain",
    "googlePlaceId": "ChIJxaAzu4EoQg0RtvLumbkqOe4"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 38,
    "name": "Coa",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/coa.html",
    "address": "Shop A, LG/F Wah Shin House, 6-10 Shin Hing Street, Central, Hong Kong",
    "googlePlaceId": "ChIJ__9zd3wABDQR9jco3PBl3bg"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 39,
    "name": "Sip & Guzzle",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/sip-guzzle.html",
    "address": "29 Cornelia St, New York, NY 10014, United States",
    "googlePlaceId": "ChIJ49KsB19ZwokR8VwrMbECQr8"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 40,
    "name": "Drink Kong",
    "city": "Rome",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/drink-kong.html",
    "address": "Piazza di S. Martino Ai Monti, 8, 00154 Rome, Italy",
    "googlePlaceId": "ChIJf3VE-7xhLxMRnMf_uACwlXc"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 41,
    "name": "Double Chicken Please",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/double-chicken-please.html",
    "address": "115 Allen St, New York, NY 1000, USA",
    "googlePlaceId": "ChIJI25hF09ZwokRnmmiXXONRf4"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 42,
    "name": "Maybe Sammy",
    "city": "Sydney",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/maybe-sammy.html",
    "address": "115 Harrington St, The Rocks NSW 2000, Sydney, Australia",
    "googlePlaceId": "ChIJgf9Tc-CvEmsRTnNt62yljIQ"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 43,
    "name": "1930",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/1930.html",
    "address": "Via Edmondo de Amicis, 22, 20123 Milan, Italy",
    "googlePlaceId": "ChIJiSX8P8PDhkcRfHhfJ4XUR8w"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 44,
    "name": "Jewel of the South",
    "city": "New Orleans",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/jewel-of-the-south.html",
    "address": "1026 St Louis St, New Orleans, Louisiana, 70112, USA",
    "googlePlaceId": "ChIJMwXLyuCnIIYRlJ9qpEg6tpI"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 45,
    "name": "Virtù",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/virtu.html",
    "address": "1 Chome-2-1 Ōtemachi, Chiyoda City, Tokyo 100-0004",
    "googlePlaceId": "ChIJlbohVy2NGGARYM9c0wZX34I"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 46,
    "name": "Overstory",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/overstory.html",
    "address": "70 Pine St 64th Floor, New York, NY 10005, USA",
    "googlePlaceId": "ChIJ_8dmJ0lbwokRIJHQFfXiMNo"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 47,
    "name": "The Bar in Front of the Bar",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/the-bar-in-front-of-the-bar.html",
    "address": "Petraki 1, Athina 105 63, Greece",
    "googlePlaceId": "ChIJMbLXGNq9oRQR2afygzKgiOE"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 48,
    "name": "The Bellwood",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/the-bellwood.html",
    "address": "41-31 Udagawacho, Shibuya, Tokyo 150-0042, Japan",
    "googlePlaceId": "ChIJV-2UmpGNGGARRwdj9J5VgdE"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 49,
    "name": "BKK Social Club",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/bkk-social-club.html",
    "address": "300, 1 Charoen Krung Rd, Khwaeng Yan Nawa, Khet Sathon, Bangkok 10120, Thailand",
    "googlePlaceId": "ChIJLwlh74qZ4jARfZDqGK5qtE4"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 50,
    "name": "Nutmeg & Clove",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/nutmeg-clove.html",
    "address": "8 Purvis St, Singapore",
    "googlePlaceId": "ChIJ932MOA0Z2jERl0YHLKdA6VY"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 51,
    "name": "Angelita",
    "city": "Madrid",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 52,
    "name": "Licorería Limantour",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 53,
    "name": "Bar Cham",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 54,
    "name": "Bar Mauro",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 55,
    "name": "Bar Pompette",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 56,
    "name": "Argo",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 57,
    "name": "Wax On",
    "city": "Berlin",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 58,
    "name": "Freni e Frizioni",
    "city": "Rome",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 59,
    "name": "Schmuck",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 60,
    "name": "LPM Dubai",
    "city": "Dubai",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 61,
    "name": "Exímia",
    "city": "São Paulo",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 62,
    "name": "Barro Negro",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 63,
    "name": "L'Antiquario",
    "city": "Naples",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 64,
    "name": "True Laurel",
    "city": "San Francisco",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 65,
    "name": "The SG Club",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 66,
    "name": "Bird",
    "city": "Copenhagen",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 67,
    "name": "Smoke & Bitters",
    "city": "Hiriketiya",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 68,
    "name": "La Sala de Laura",
    "city": "Bogotá",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 69,
    "name": "Hero Bar",
    "city": "Nairobi",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 70,
    "name": "Gokan",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": "30 Ice House St, Central, Hong Kong",
    "googlePlaceId": "ChIJR5ZeewABBDQRSqwvf8DTOxY"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 71,
    "name": "El Gallo Altanero",
    "city": "Guadalajara",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 72,
    "name": "Attaboy",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 73,
    "name": "🔶🟥🔵 A Bar with Shapes For a Name",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 74,
    "name": "Vender",
    "city": "Taichung",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 75,
    "name": "Martiny's",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 76,
    "name": "Tjoget",
    "city": "Stockholm",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 77,
    "name": "Arca",
    "city": "Tulum",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 78,
    "name": "Baltra Bar",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 79,
    "name": "Kwãnt Mayfair",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 80,
    "name": "Three Sheets Soho",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 81,
    "name": "Mamba Negra",
    "city": "Medellín",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 82,
    "name": "Café La Trova",
    "city": "Miami",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 83,
    "name": "Dr. Stravinsky",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 84,
    "name": "Native",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 85,
    "name": "Boadas",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 86,
    "name": "The Savory Project",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 87,
    "name": "Victor Audio Bar",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 88,
    "name": "Dry Wave Cocktail Studio",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": "2nd Floor, 263 Thong Lo 13 Alley, Khlong Tan Nuea, Watthana, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJYRzUEACf4jAR5YxPdMHC300"
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 89,
    "name": "Foco",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 90,
    "name": "Florería Atlántico",
    "city": "Buenos Aires",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 91,
    "name": "Byrdi",
    "city": "Melbourne",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 92,
    "name": "Opium",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 93,
    "name": "Mírate",
    "city": "Los Angeles",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 95,
    "name": "Employees Only",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 96,
    "name": "Lair",
    "city": "New Delhi",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 97,
    "name": "Kumiko",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 98,
    "name": "Jerry Thomas Speakeasy",
    "city": "Rome",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 99,
    "name": "Gucci Giardino",
    "city": "Florence",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "world",
    "year": 2025,
    "rank": 100,
    "name": "Bar Carmen",
    "city": "Medellín",
    "url": "https://www.the50.com/bars/best-in-the-world/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 1,
    "name": "Hope & Sesame",
    "city": "Guangzhou",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/hope-and-sesame.html",
    "address": "Miaoqian Xijie 58, Guangzhou"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 2,
    "name": "Zest",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/zest.html",
    "address": "B1 26 KR 55 Dosan-daero 55-gil, Gangnam-gu, Seoul, Korea",
    "googlePlaceId": "ChIJ9eN6-_GlfDUR5SGWDB7YNkw"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 3,
    "name": "Bar Leone",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-leone.html",
    "address": "15 Bridges St, Central, Hong Kong",
    "googlePlaceId": "ChIJqyyPsGUBBDQRE5twNod5Lk8"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 4,
    "name": "Dry Wave Cocktail Studio",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/dry-wave-cocktail-studio.html",
    "address": "2nd Floor, 263 Thong Lo 13 Alley, Khlong Tan Nuea, Watthana, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJYRzUEACf4jAR5YxPdMHC300"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 5,
    "name": "MO Bar Shenzhen",
    "city": "Shenzhen",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/mo-bar-shenzhen.html",
    "address": "5001 Huanggang Road, Upper Hills, Shenzhen, China"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 6,
    "name": "Bar Us",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-us.html",
    "address": "1/37 Floor, 1 Soi Sukhumvit 26, Khlong Tan, Khlong Toei, Bangkok 10110, Thailand",
    "googlePlaceId": "ChIJG5QaZUKf4jARMm-GbfMbX4A"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 7,
    "name": "Lennon's",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/lennons.html",
    "address": "30 Floor, Rosewood Bangkok, 1041/38 Phloen Chit Rd, Lumphini, Pathum Wan, Bangkok 10330, Thailand"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 8,
    "name": "Boilermaker",
    "city": "Goa",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/boilermaker.html",
    "address": "Church, Vaddi Siolim . Enroute Thalassa from, opposite Vailanka Wine store, Siolim, Goa, 403517, India"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 9,
    "name": "Jigger & Pony",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/jigger-pony.html",
    "address": "165 Tg Pagar Rd, Amara Hotel, Singapore 088539",
    "googlePlaceId": "ChIJ36AdBg0Z2jERvFl0QFoqZ0E"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 10,
    "name": "Obsidian Bar",
    "city": "Shenzhen",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/obsidian.html",
    "address": "Level 4 (L4), South Tower, Ping An Finance Center, 16 Fuhua 4th Road, Shenzhen"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 11,
    "name": "Modernhaus",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/modernhaus.html",
    "address": "Jl. Senopati No.79, RT.8/RW.3, Selong, Kec. Kby. Baru, Jakarta, Daerah Khusus Ibukota Jakarta 12190, Indonesia"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 12,
    "name": "Nutmeg & Clove",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/nutmeg-clove.html",
    "address": "8 Purvis St, Singapore",
    "googlePlaceId": "ChIJ932MOA0Z2jERl0YHLKdA6VY"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 13,
    "name": "Alice",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/alice.html",
    "address": "84-20 Dosan-daero 55-gil, Gangnam-gu, Seoul"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 14,
    "name": "Vender",
    "city": "Taichung",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/vender.html",
    "address": "No. 118, Wuquan West 4th St, West District, Taichung"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 15,
    "name": "Cosmo Pony",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/cosmo-pony.html",
    "address": "Grand Hyatt Jakarta, 4th Floor, Jl. M.H. Thamrin Kav. 28-30, Jakarta, Daerah Khusus Ibukota Jakarta 10350, Indonesia"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 16,
    "name": "Offtrack",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/offtrack.html",
    "address": "34 N Canal Rd, #01-01, Singapore 059290"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 17,
    "name": "Bar Sathorn",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-sathorn.html",
    "address": "The House on Sathorn, 106 N Sathon Rd, Si Lom, Khet Bang Rak, Bangkok 10500, Thailand"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 18,
    "name": "Soka",
    "city": "Bengaluru",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/soka.html",
    "address": "No.210, A cross, 1st Main Rd, 2nd stage Indiranagar, Stage 2, Domlur, Bengaluru, Karnataka 560071, India"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 19,
    "name": "Pony Up",
    "city": "Shanghai",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/pony-up.html",
    "address": "230 Jinxian Road, Huangpu District, Shanghai, 200041"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 20,
    "name": "BKK Social Club",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bkk-social-club.html",
    "address": "300, 1 Charoen Krung Rd, Khwaeng Yan Nawa, Khet Sathon, Bangkok 10120, Thailand",
    "googlePlaceId": "ChIJLwlh74qZ4jARfZDqGK5qtE4"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 21,
    "name": "Carrots Bar",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/carrots-bar.html",
    "address": "Fairgrounds SCBD Jl. Jenderal Sudirman No.14 Lot 14, Basement Level, Jakarta 12190, Indonesia"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 22,
    "name": "Gokan",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/gokan.html",
    "address": "30 Ice House St, Central, Hong Kong",
    "googlePlaceId": "ChIJR5ZeewABBDQRSqwvf8DTOxY"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 23,
    "name": "Punch Room Tokyo",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/punch-room-tokyo.html",
    "address": "2 Chome−8−13 東京エディション銀座 2階, Ginza, Chuo City, Tokyo, 〒104-0061"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 24,
    "name": "Coa",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/coa.html",
    "address": "Shop A, LG/F Wah Shin House, 6-10 Shin Hing Street, Central, Hong Kong",
    "googlePlaceId": "ChIJ__9zd3wABDQR9jco3PBl3bg"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 25,
    "name": "Opium",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/opium.html",
    "address": "422 Vanich 1 Rd, Samphanthawong, Bangkok 10100, Thailand"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 26,
    "name": "Virtù",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/virtu.html",
    "address": "1 Chome-2-1 Ōtemachi, Chiyoda City, Tokyo 100-0004",
    "googlePlaceId": "ChIJlbohVy2NGGARYM9c0wZX34I"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 27,
    "name": "CMYK",
    "city": "Changsha",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/CMYK.html",
    "address": "388 Zhongshan West Road, Changsha, Hunan, 452370"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 28,
    "name": "Ralph's Bar",
    "city": "Chengdu",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/ralphs-bar.html",
    "address": "Taikooli 2224b 3/F, No. 8 Sha Mao St, Jin Jiang District, Chengdu, Sichuan"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 29,
    "name": "Smoke & Bitters",
    "city": "Hiriketiya",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/smoke-and-bitters.html",
    "address": "Pehebiya Rd, Dickwella, Matara, Hiriketiya"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 30,
    "name": "Bar Spirit Forward",
    "city": "Bengaluru",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-spirit-forward.html",
    "address": "Ground Floor, Hotel Southern Star, 40/2, Lavelle Road, Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka 560001, India"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 31,
    "name": "G.O.D",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/god-bangkok.html",
    "address": "25, 27 Soi Rammaitree, Pom Prap, Pom Prap Sattru Phai, Bangkok 10100"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 32,
    "name": "Three X Co",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/three-x-co.html",
    "address": "Lot T6A, Level 3, Bangsar Shopping Centre, 285, Jalan Maarof, Bangsar, 59000 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, Malaysia"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 33,
    "name": "Bar Cham",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/cham-bar.html",
    "address": "34 Jahamun-ro 7-gil, Tongin-dong, Jongno-gu, Seoul"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 34,
    "name": "Workshop14",
    "city": "Hanoi",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/Workshop14.html",
    "address": "6 Alley 5, Tu Hoa Street, Tay Ho District, Hanoi"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 35,
    "name": "To Infinity & Beyond",
    "city": "Taipei",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/to-infinity-and-beyond.html",
    "address": "No. 13號, Lane 160, Section 1, Dunhua S Rd, Da’an District, Taipei City, Taiwan 106"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 36,
    "name": "Mius",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/mius.html",
    "address": "29 Gough St, Central, Hong Kong",
    "googlePlaceId": "ChIJbclJp1ABBDQRmYIcm3q29rw"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 37,
    "name": "Argo",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/argo.html",
    "address": "8 Finance St, Central, Hong Kong"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 38,
    "name": "Bar Trigona",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-trigona.html",
    "address": "Four Seasons Place, 145, Jalan Ampang, 50450 Kuala Lumpur"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 39,
    "name": "Bar Libre",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/bar-libre.html",
    "address": "3 Chome−25−8 相馬屋ビル B1F, Nishiikebukuro, Toshima City, Tokyo, Japan"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 40,
    "name": "The Golden Tooth",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/the-golden-tooth.html",
    "address": "Jl. Adityawarman No.71, RT.5/RW.2, Melawai, Kec. Kby. Baru, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12160, Indonesia"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 41,
    "name": "The Han-Jia",
    "city": "Tainan",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/the-han-jia.html",
    "address": "No. 669號, Section 1, Ximen Rd, Xinchang Village, South District, Tainan City, Taiwan 702"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 42,
    "name": "M+MS Bar",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/MMS-bar.html",
    "address": "32-1 Dosan-daero 49-gil, Gangnam District, Seoul, South Korea"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 43,
    "name": "Origin Bar",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/origin-bar.html",
    "address": "Lobby Level, Tower Wing, 22 Orange Grove Rd, Singapore 258350"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 44,
    "name": "Problem Child",
    "city": "Makati",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/problem-child.html",
    "address": "Unit 107 G/F, 369, Executive Building, Jupiter, Makati City, Metro Manila, Philippines"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 45,
    "name": "The St. Regis Bar (Macau)",
    "city": "Macau",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/the-st-regis-bar-macau.html",
    "address": "Sands Cotai Central Cotai Strip, Macao"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 46,
    "name": "The Hudson Rooms",
    "city": "Hanoi",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/the-hudson-room.html",
    "address": "11 P. Lê Phụng Hiểu, French Quarter, Hoàn Kiếm, Hà Nội, Vietnam"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 47,
    "name": "Montana",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/montana.html",
    "address": "Shop A, G/F, 108 Hollywood Rd, Central, Hong Kong"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 48,
    "name": "Aqua Bar",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/aqua-bar.html",
    "address": "Lumphini, Pathum Wan, Bangkok 10330, Thailand"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 49,
    "name": "Penicillin",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/penicillin.html",
    "address": "L/G Amber Lodge, 23 Hollywood Road, Central, Hong Kong"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 50,
    "name": "Tiao",
    "city": "Beijing",
    "url": "https://www.the50.com/bars/best-in-asia/the-list/tiao.html",
    "address": "No.1 Caochang Alley 10, Dongcheng District, Beijing, 100005, China"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 51,
    "name": "Bar Outrigger",
    "city": "Goa",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 52,
    "name": "BOP",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 53,
    "name": "Bar Trench",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 54,
    "name": "The Opposites",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 55,
    "name": "The Enigma Mansion",
    "city": "Ho Chi Minh City",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "5H Tôn Đức Thắng, Sài Gòn, Hồ Chí Minh 700000 베트남",
    "googlePlaceId": "ChIJp9D-CQAvdTERIG0PumUYzQ0"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 56,
    "name": "Vesper",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "10/15 Convent Road, Silom, Bangkok",
    "googlePlaceId": "ChIJN4leQSyf4jARHG0tQIiRjic"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 57,
    "name": "Side Door",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 58,
    "name": "The Elephant Room",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 59,
    "name": "Yakoboku",
    "city": "Kumamoto",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 60,
    "name": "The Savory Project",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 61,
    "name": "Barc",
    "city": "Kathmandu",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 62,
    "name": "Bar Benfiddich",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "9F, 1 Chome-13-7, Nishishinjuku, Shinjuku City, 160-0023 Tokyo, Japan",
    "googlePlaceId": "ChIJZUTGW9GMGGAROJ7G4sU221Q"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 63,
    "name": "Reka",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 64,
    "name": "Penrose",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 65,
    "name": "Cabinet 8",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 66,
    "name": "Backdoor Bodega",
    "city": "Penang",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 67,
    "name": "Moonrock",
    "city": "Tainan",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 68,
    "name": "Maltail",
    "city": "Kaohsiung",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 69,
    "name": "Messenger Service",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 70,
    "name": "Bar Nayuta",
    "city": "Osaka",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 71,
    "name": "Raa",
    "city": "Hiriketiya",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 72,
    "name": "Craftroom",
    "city": "Osaka",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 73,
    "name": "Between the Sips",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 74,
    "name": "Gong Gan",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 75,
    "name": "The Bar at the Ritz-Carlton Tokyo",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 76,
    "name": "Mahaniyom Cocktail Bar",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 77,
    "name": "Hats Bar",
    "city": "Jakarta",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 78,
    "name": "Firefly",
    "city": "Bangkok",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 79,
    "name": "The Bellwood",
    "city": "Tokyo",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "41-31 Udagawacho, Shibuya, Tokyo 150-0042, Japan",
    "googlePlaceId": "ChIJV-2UmpGNGGARRwdj9J5VgdE"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 80,
    "name": "Native",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 81,
    "name": "Tell Camellia",
    "city": "Hong Kong",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 82,
    "name": "Bar Mood",
    "city": "Taipei",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 83,
    "name": "Coley",
    "city": "Kuala Lumpur",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 84,
    "name": "Stir",
    "city": "Ho Chi Minh City",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "1st Floor, 136 Lê Thánh Tôn, ward, Bến Thành, Hồ Chí Minh, 베트남",
    "googlePlaceId": "ChIJL1F-QA8vdTERWxUrkSDOxXM"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 85,
    "name": "Aabbcc",
    "city": "New Delhi",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 86,
    "name": "Cat Bite Club",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 87,
    "name": "Charles H",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 88,
    "name": "Le Chamber",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 89,
    "name": "Soko",
    "city": "Seoul",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 90,
    "name": "Bar Bon Funk",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 91,
    "name": "Chimney",
    "city": "Hangzhou",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 92,
    "name": "The Public House",
    "city": "Taipei",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 93,
    "name": "Ropewalk",
    "city": "Galle",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 94,
    "name": "Lamp Bar",
    "city": "Nara",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": "26 Tsunofuricho, Nara, 630-8224, Japan",
    "googlePlaceId": "ChIJ68mQxSk6AWARxcziBW9XXqQ"
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 95,
    "name": "Coa (Shanghai)",
    "city": "Shanghai",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 96,
    "name": "Bar Long Fong",
    "city": "Beijing",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 97,
    "name": "Stay Gold Flamingo",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 98,
    "name": "The Spirits Library",
    "city": "Makati",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 99,
    "name": "Lab",
    "city": "Taipei",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "asia",
    "year": 2026,
    "rank": 100,
    "name": "Sora",
    "city": "Phnom Penh",
    "url": "https://www.the50.com/bars/best-in-asia/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 1,
    "name": "Line",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Agathodemonos 37, Orestou 1, 118 53 Athens, Greece",
    "googlePlaceId": "ChIJ13n7hoG9oRQRXHgFVrMGEGU"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 2,
    "name": "The Bar in Front of the Bar",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Petraki 1, Athina 105 63, Greece",
    "googlePlaceId": "ChIJMbLXGNq9oRQR2afygzKgiOE"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 3,
    "name": "Sips",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "C/ de Muntaner, 108, 08036 Barcelona, Spain",
    "googlePlaceId": "ChIJVeGtVgijpBIRGhWNVpFekW0"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 4,
    "name": "Himkok",
    "city": "Oslo",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Storgata 27, 0184 Oslo, Norway",
    "googlePlaceId": "ChIJUyV7KGJuQUYRohEJQ-fnslw"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 5,
    "name": "Bar Nouveau",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "5 Rue des Haudriettes, 75003 Paris, France",
    "googlePlaceId": "ChIJ4YqD5chv5kcRf4-j_pVUvnc"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 6,
    "name": "Moebius Milano",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Via Alfredo Cappellini, 25, 20124 Milano MI, Italy",
    "googlePlaceId": "ChIJSVm3PfbHhkcRPeDWzSh9BS8"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 7,
    "name": "The Cambridge Public House",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "8 Rue de Poitou, 75003 Paris, France",
    "googlePlaceId": "ChIJf1PlS6hv5kcRfxnt_fDSpyE"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 8,
    "name": "Mirror Bar",
    "city": "Bratislava",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Radisson Blu Carlton Hotel, Bratislava, Hviezdoslavovo námestie 3, 811 02 Bratislava, Slovakia",
    "googlePlaceId": "ChIJDWebZPGJbEcRFar4JUg0LkY"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 9,
    "name": "Paradiso",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Carrer de Rera Palau, 4, 08003 Barcelona, Spain",
    "googlePlaceId": "ChIJUxwdO_6ipBIRdMGRVDsolaM"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 10,
    "name": "Connaught Bar",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Connaught, Carlos Pl, London W1K 2A, UK",
    "googlePlaceId": "ChIJ0aqjLCwFdkgRsvmYeG290jE"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 11,
    "name": "Satan's Whiskers",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "343 Cambridge Heath Rd, London E2 9RA, UK",
    "googlePlaceId": "ChIJf9GjdNscdkgRPi-9Fxb6iDo"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 12,
    "name": "Tayēr + Elementary",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "152 Old St, London EC1V 9BW, UK",
    "googlePlaceId": "ChIJP72YPh8ddkgRHAMOeJp_gEI"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 13,
    "name": "Barro Negro",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 14,
    "name": "Baba au Rum",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Klitiou 6, 105 60 Athens, Greece",
    "googlePlaceId": "ChIJFVsBjjy9oRQR7XnarON2k94"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 15,
    "name": "Svanen",
    "city": "Oslo",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Karl Johans gt. 13, 0154 Oslo, Norway",
    "googlePlaceId": "ChIJD_-Fb2pvQUYRjcMxOgNFm2c"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 16,
    "name": "Nouvelle Vague",
    "city": "Tirana",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Rruga Pjetër Bogdani, Tiranë, Albania",
    "googlePlaceId": "ChIJwUqyygMxUBMRSclrxBuvLqQ"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 17,
    "name": "Wax On",
    "city": "Berlin",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 18,
    "name": "Camparino in Galleria",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 19,
    "name": "Danico",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "6 Rue Vivienne, 75002 Paris, France",
    "googlePlaceId": "ChIJP-sdWztu5kcRmKJqBJVhzfw"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 20,
    "name": "Panda & Sons",
    "city": "Edinburgh",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "79 Queen St, Edinburgh EH2 4NF, UK",
    "googlePlaceId": "ChIJc8uwh73Hh0gRUxs-kdJ18DU"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 21,
    "name": "Locale Firenze",
    "city": "Florence",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Via delle Seggiole, 12r, 50122 Florence, Italy",
    "googlePlaceId": "ChIJg0T1mgZUKhMRp59MjreQ_7w"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 22,
    "name": "1930",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Via Edmondo de Amicis, 22, 20123 Milan, Italy",
    "googlePlaceId": "ChIJiSX8P8PDhkcRfHhfJ4XUR8w"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 23,
    "name": "Waltz",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 24,
    "name": "Bird",
    "city": "Copenhagen",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 25,
    "name": "Alma Prague",
    "city": "Prague",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 26,
    "name": "Aldea",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 27,
    "name": "Harry's Bar Paris",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 28,
    "name": "L'Antiquario",
    "city": "Naples",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 29,
    "name": "Gucci Giardino",
    "city": "Florence",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 30,
    "name": "The Clumsies",
    "city": "Athens",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 31,
    "name": "Freni e Frizioni",
    "city": "Rome",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 32,
    "name": "Drink Kong",
    "city": "Rome",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Piazza di S. Martino Ai Monti, 8, 00154 Rome, Italy",
    "googlePlaceId": "ChIJf3VE-7xhLxMRnMf_uACwlXc"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 33,
    "name": "Gorilla",
    "city": "Thessaloniki",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 34,
    "name": "De Vie",
    "city": "Paris",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 35,
    "name": "14 De La Rosa",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 36,
    "name": "Boadas",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 37,
    "name": "Tjoget",
    "city": "Stockholm",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 38,
    "name": "Forbína Bar",
    "city": "Prague",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 39,
    "name": "Tag",
    "city": "Krakow",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 40,
    "name": "Kwãnt Mayfair",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 41,
    "name": "Three Sheets (Soho)",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 42,
    "name": "Super Lyan",
    "city": "Amsterdam",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 43,
    "name": "Röda Huset",
    "city": "Stockholm",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Malmskillnadsgatan 9, 111 57 Stockholm, Sweden",
    "googlePlaceId": "ChIJD9TAUaGdX0YRiCmb4VoK9gY"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 44,
    "name": "Late Bloomers",
    "city": "Zurich",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 45,
    "name": "Angelita",
    "city": "Madrid",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 46,
    "name": "Salmon Guru",
    "city": "Madrid",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Calle de Echegaray, 21, 28014 Madrid, Spain",
    "googlePlaceId": "ChIJxaAzu4EoQg0RtvLumbkqOe4"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 47,
    "name": "Scarfes Bar",
    "city": "London",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": "Rosewood London, 252 High Holborn, London WC1V 7EN, UK",
    "googlePlaceId": "ChIJi-8-gTUbdkgRlnM1J18fB24"
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 48,
    "name": "Foco",
    "city": "Barcelona",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 49,
    "name": "Rita",
    "city": "Milan",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "europe",
    "year": 2025,
    "rank": 50,
    "name": "Dunlin",
    "city": "Innsbruck",
    "url": "https://www.the50.com/bars/best-in-europe/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 1,
    "name": "Sip & Guzzle",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/sip-guzzle.html",
    "address": "29 Cornelia St, New York, NY 10014, United States",
    "googlePlaceId": "ChIJ49KsB19ZwokR8VwrMbECQr8"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 2,
    "name": "Bar Mauro",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bar-mauro.html",
    "address": "Tabasco 149, Roma Nte., Cuauhtémoc, 06700 Ciudad de México, CDMX, Mexico"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 3,
    "name": "Bar Snack",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bar-snack.html",
    "address": "92 2nd Ave, New York, NY 10003, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 4,
    "name": "Schmuck",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/schmuck.html",
    "address": "97 1st Ave, New York, NY 10003, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 5,
    "name": "Tlecān",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/tlecan.html",
    "address": "Av. Álvaro Obregón 228-Local 2, Roma Nte., Cuauhtémoc, 06700 Ciudad de México, CDMX, Mexico",
    "googlePlaceId": "ChIJRbtqqOX_0YURJkwQEFZd2cs"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 6,
    "name": "Jewel of the South",
    "city": "New Orleans",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/jewel-of-the-south.html",
    "address": "1026 St Louis St, New Orleans, Louisiana, 70112, USA",
    "googlePlaceId": "ChIJMwXLyuCnIIYRlJ9qpEg6tpI"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 7,
    "name": "The Keefer Bar",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/The-keefer-bar.html",
    "address": "135 Keefer St, Vancouver, BC V6A 1X3, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 8,
    "name": "Bar Pompette",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Bar-pompette.html",
    "address": "607 College St, Toronto, ON M6G 1B5, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 9,
    "name": "Superbueno",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/superbueno.html",
    "address": "13 1st Ave., New York, NY 10003",
    "googlePlaceId": "ChIJbXN71WhZwokRNTk55-ScVWY"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 10,
    "name": "El Gallo Altanero",
    "city": "Guadalajara",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/el-gallo-altanero.html",
    "address": "Calle Marsella 126, Col Americana, Lafayette, Guadalajara, 44160"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 11,
    "name": "Kumiko",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Kumiko.html",
    "address": "630 W Lake St, Chicago, Illinois, 60661"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 12,
    "name": "Handshake Speakeasy",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/handshake-speakeasy.html",
    "address": "C. Amberes 65, Juárez, Cuauhtémoc, 06600 Mexico City, Mexico",
    "googlePlaceId": "ChIJU_vg0kID0oUR37k2I3XazcM"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 13,
    "name": "Form + Matter",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/form-matter.html",
    "address": "San Luis Potosí 37, Roma Nte., Cuauhtémoc, 06700 Ciudad de México, CDMX, Mexico"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 14,
    "name": "True Laurel",
    "city": "San Francisco",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/true-laurel.html",
    "address": "753 Alabama St, San Francisco, CA 94110, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 15,
    "name": "Clemente Bar",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/clemente-bar.html",
    "address": "11 Madison Ave, New York, NY 10010, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 16,
    "name": "Best Intentions",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Best-intentions.html",
    "address": "3281 W Armitage Ave, Chicago, IL 60647, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 17,
    "name": "June on Cambie",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/june-on-cambie.html",
    "address": "3305 Cambie St., Vancouver, BC V5Z 2W6, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 18,
    "name": "Mecenas",
    "city": "Guadalajara",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/mecenas.html",
    "address": "Av. de la Paz 2133, Col Americana, Americana, 44150 Guadalajara, Jal., Mexico"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 19,
    "name": "Library Bar",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/library-bar.html",
    "address": "100 Front St W, Toronto, ON M5J 1E3, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 20,
    "name": "Licorería Limantour",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/licoreria-limantour.html",
    "address": "Av. Álvaro Obregón 106, Roma Nte., Cuauhtémoc, Mexico City, 06700"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 21,
    "name": "Cure",
    "city": "New Orleans",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Cure.html",
    "address": "4905 Freret St, New Orleans, LA 70115, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 22,
    "name": "Mother",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/mother.html",
    "address": "874 Queen St W, Toronto, ON M6J 2V1, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 23,
    "name": "Martiny's",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/martinys.html",
    "address": "121 E 17th Street, Gramercy Park, New York, 10003"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 24,
    "name": "Bekeb",
    "city": "San Miguel de Allende",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bekeb.html",
    "address": "Calz. De La Presa No. 85, Zona Centro, 37700 San Miguel de Allende, Gto., Mexico"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 25,
    "name": "Kaito del Valle",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/kaito-del-valle.html",
    "address": "Hamburgo 70B, Juárez, Cuauhtémoc, 06600"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 26,
    "name": "La Factoría",
    "city": "San Juan",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/la-factoria.html",
    "address": "148 C. de San Sebastián, San Juan, Puerto Rico, 00901"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 27,
    "name": "Gus' Sip & Dip",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/gus-sip-dip.html",
    "address": "51 W Hubbard St Suite 100, Chicago, IL 60654, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 28,
    "name": "Mírate",
    "city": "Los Angeles",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Mirate.html",
    "address": "1712 N Vermont Ave, Los Angeles, CA 90027, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 29,
    "name": "Civil Works",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/civil-works.html",
    "address": "50 Brant St, Toronto, ON M5V 3G9, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 30,
    "name": "Bisous",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bisous.html",
    "address": "938 W Fulton Market, Chicago, IL 60607, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 31,
    "name": "Angel's Share",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Angels-share.html",
    "address": "45 Grove St, New York, NY 10014, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 32,
    "name": "Prophecy",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/prophecy.html",
    "address": "801 W Georgia St, Vancouver, BC V6C 1P7, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 33,
    "name": "Overstory",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/overstory.html",
    "address": "70 Pine St 64th Floor, New York, NY 10005, USA",
    "googlePlaceId": "ChIJ_8dmJ0lbwokRIJHQFfXiMNo"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 34,
    "name": "Press Club",
    "city": "Washington DC",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/press-club.html",
    "address": "1506 19th St NW, Washington, DC 20036, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 35,
    "name": "Double Chicken Please",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/double-chicken-please.html",
    "address": "115 Allen St, New York, NY 1000, USA",
    "googlePlaceId": "ChIJI25hF09ZwokRnmmiXXONRf4"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 36,
    "name": "Bar Madonna",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bar-madonna.html",
    "address": "367 Metropolitan Ave, Brooklyn, NY 11211, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 37,
    "name": "Attaboy",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/attaboy.html",
    "address": "134 Eldridge St, New York, NY 10002, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 38,
    "name": "Botanist Bar",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/botanist-bar.html",
    "address": "1038 Canada Pl, Vancouver, BC V6C 0B9, Canada"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 39,
    "name": "Service Bar",
    "city": "Washington DC",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/service-bar.html",
    "address": "926-928 U St NW, Washington DC, 20001"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 40,
    "name": "Maison Premiere",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/maison-premiere.html",
    "address": "298 Bedford Ave, Brooklyn, NY 11249, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 41,
    "name": "Pacific Cocktail Haven",
    "city": "San Francisco",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/pacific-cocktail-haven.html",
    "address": "550 Sutter St, San Francisco, CA 94108, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 42,
    "name": "Café La Trova",
    "city": "Miami",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/cafe-la-trova.html",
    "address": "971 SW 8th St, Miami, Florida, 33130"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 43,
    "name": "Selva",
    "city": "Oaxaca",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Selva.html",
    "address": "C. Macedonio Alcalá #403-int. 6, Ruta Independencia, Centro, Oaxaca, 68000"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 44,
    "name": "Daisy Margarita Bar",
    "city": "Los Angeles",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/daisy-margarita-bar.html",
    "address": "14633 Ventura Blvd, Sherman Oaks, CA 91403, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 45,
    "name": "Employees Only",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Employees-Only.html",
    "address": "510 Hudson St, New York, NY 10014, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 46,
    "name": "Viceversa",
    "city": "Miami",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/viceversa.html",
    "address": "398 NE 5th St, Miami, FL 33132, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 47,
    "name": "Bandista",
    "city": "Houston",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bandista.html",
    "address": "1300 Lamar St, Houston, TX 77010, United States"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 48,
    "name": "Baltra Bar",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/Baltra-bar.html",
    "address": "Iztaccihuatl 36D, Colonia Condesa, Cuauhtémoc, Mexico City, 06100"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 49,
    "name": "Library by the Sea",
    "city": "Grand Cayman",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/library-by-the-sea.html",
    "address": "Seven Mile Beach, 60 Tanager Way, KY1-1303, Cayman Islands"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 50,
    "name": "Bon Vivants",
    "city": "Nassau",
    "url": "https://www.the50.com/bars/best-in-north-america/the-list/bon-vivants.html",
    "address": "401 Seaskye Lane, Nassau, Bahamas"
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 51,
    "name": "Aruba Day Drink",
    "city": "Tijuana",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 52,
    "name": "Katana Kitten",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 53,
    "name": "Humboldt Bar",
    "city": "Victoria",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 54,
    "name": "Civil Liberties",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 55,
    "name": "Silver Lyan",
    "city": "Washington DC",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 56,
    "name": "Cloakroom",
    "city": "Montreal",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 57,
    "name": "Allegory",
    "city": "Washington DC",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 58,
    "name": "Dante",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 59,
    "name": "Bagheera",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 60,
    "name": "Café de Nadie",
    "city": "Mexico City",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 61,
    "name": "Arca",
    "city": "Tulum",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 62,
    "name": "Atwater Cocktail Club",
    "city": "Montreal",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 63,
    "name": "Scotch Lodge",
    "city": "Portland",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 64,
    "name": "Meo",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 65,
    "name": "Meadowlark",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 66,
    "name": "Seed Library",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 67,
    "name": "Yacht Club",
    "city": "Denver",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 68,
    "name": "Vandell",
    "city": "Los Angeles",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 69,
    "name": "Cry Baby Gallery",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 70,
    "name": "Bar Kaiju",
    "city": "Miami",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 71,
    "name": "The Portrait Bar",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 72,
    "name": "Laowai",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 73,
    "name": "Identidad",
    "city": "San Juan",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 74,
    "name": "Suite 115",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 75,
    "name": "Bar Bello",
    "city": "Montreal",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 76,
    "name": "Nine Bar",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 77,
    "name": "Shinji’s",
    "city": "New York",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 78,
    "name": "Proof",
    "city": "Calgary",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 79,
    "name": "Missy's",
    "city": "Calgary",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 80,
    "name": "Queen Mary",
    "city": "Chicago",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 81,
    "name": "Bar Leather Apron",
    "city": "Honolulu",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 82,
    "name": "No Vacancy",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 83,
    "name": "Father Forgive Me",
    "city": "Detroit",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 84,
    "name": "Julep",
    "city": "Houston",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 85,
    "name": "Ticonderoga Club",
    "city": "Atlanta",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 86,
    "name": "The Wig Shop",
    "city": "Boston",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 87,
    "name": "Citrus & Cane",
    "city": "Victoria",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 88,
    "name": "Hecate Bar",
    "city": "Boston",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 89,
    "name": "Roquette",
    "city": "Seattle",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 90,
    "name": "Slice Of Life",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 91,
    "name": "Mount Pleasant Vintage & Provisions",
    "city": "Vancouver",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 92,
    "name": "Thunderbolt",
    "city": "Los Angeles",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 93,
    "name": "Realm of 52 Remedies",
    "city": "San Diego",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 94,
    "name": "Bar Mordecai",
    "city": "Toronto",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 95,
    "name": "Zapote Bar",
    "city": "Playa del Carmen",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 96,
    "name": "Nickel City",
    "city": "Austin",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 97,
    "name": "The Coldroom",
    "city": "Montreal",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 98,
    "name": "Shelter",
    "city": "Calgary",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 99,
    "name": "Door No.4",
    "city": "Grand Cayman",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  },
  {
    "kind": "bars",
    "scope": "north-america",
    "year": 2026,
    "rank": 100,
    "name": "Trick Dog",
    "city": "San Francisco",
    "url": "https://www.the50.com/bars/best-in-north-america/list/51-100",
    "address": ""
  }
]
/** Latest editions first so one-place search deduplication preserves the newest record. */
export const WORLD_BEST: WorldBest[] = [...CURRENT_WORLD_BEST, ...BEST_HISTORY, ...BEST_DISCOVERY]
const byPlaceId = new Map<string, WorldBest[]>()
for (const award of WORLD_BEST) {
  if (!award.googlePlaceId) continue
  const rows = byPlaceId.get(award.googlePlaceId) ?? []
  rows.push(award)
  byPlaceId.set(award.googlePlaceId, rows)
}
export function worldBestKey(row: WorldBest): string { return `${row.kind}:${row.scope}:${row.year ?? "discovery"}:${row.rank ?? row.url}` }
export function worldBestStatus(row: WorldBest): string {
  if (row.recognition === "discovery") return "소개 장소"
  const latest = CURRENT_WORLD_BEST.find(r => r.kind === row.kind && r.scope === row.scope)
  return latest?.year === row.year ? "최신 선정" : "과거 선정"
}
export function sortBestHistory(rows: WorldBest[]): WorldBest[] {
  return [...rows].sort((a,b) => (b.year ?? 0) - (a.year ?? 0) || (a.rank ?? 0) - (b.rank ?? 0))
}

const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "")
/** Verified permanent place IDs first (2026-09-20 official street review); otherwise exact name + street.
 * Ambiguous Hope & Sesame and Celele are deliberately not linked. No Google coordinates/photos stored here. */
export function worldBestFor(name: string, address: string | null | undefined, googlePlaceId?: string | null): WorldBest[] {
  if (googlePlaceId) return sortBestHistory(byPlaceId.get(googlePlaceId) ?? [])
  if (!address) return []
  const n = norm(name), a = norm(address)
  return sortBestHistory(WORLD_BEST.filter(r => {
    const expected = norm(r.name)
    if (n !== expected) return false
    const segments = r.address.split(",").filter(part => /\d/.test(part))
    const words = segments.flatMap(part => part.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]{3,}|\d+/g) ?? [])
    const numbers = new Set(address.match(/\d+/g) ?? [])
    return words.some(w => /^[a-z]{4,}$/.test(w)) && words.every(w => /^\d+$/.test(w) ? numbers.has(w) : a.includes(w))
  }))
}
export function worldBestLabel(row: WorldBest): string {
  if (row.recognition === "discovery") return `50 BEST DISCOVERY · ${row.kind === "bars" ? "바" : "레스토랑"} · 소개 장소`
  return `${BEST_SCOPE_LABELS[row.scope ?? "world"]} · 50 BEST ${row.kind === "bars" ? "BARS" : "RESTAURANTS"} · ${row.year} ${row.rank}위`
}
