/** Official World’s 50 Best lists, read 2026-09-20. Both published lists identify edition 2025.
 * Facts only; no photos/review prose copied. Refresh from official list-year, never infer year.
 * https://www.the50.com/restaurants/best-in-the-world/list/1-50
 * https://www.the50.com/bars/best-in-the-world/list/1-50
 */
export type WorldBest = { kind: "restaurants" | "bars"; year: number; rank: number; name: string; city: string; url: string; address: string; googlePlaceId?: string }
export const WORLD_BEST: WorldBest[] = [
  {
    "kind": "bars",
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
    "year": 2025,
    "rank": 29,
    "name": "Hope & Sesame",
    "city": "Guangzhou",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/hope-sesame.html",
    "address": "Miaoqian Xijie 58, Guangzhou"
  },
  {
    "kind": "bars",
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
    "year": 2025,
    "rank": 50,
    "name": "Nutmeg & Clove",
    "city": "Singapore",
    "url": "https://www.the50.com/bars/best-in-the-world/the-list/nutmeg-clove.html",
    "address": "8 Purvis St, Singapore",
    "googlePlaceId": "ChIJ932MOA0Z2jERl0YHLKdA6VY"
  },
  {
    "kind": "restaurants",
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
    "year": 2025,
    "rank": 48,
    "name": "Celele",
    "city": "Cartagena",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/celele.html",
    "address": "Calle del Espiritu Santo, cr 10c # 29 – 200, Getsemaní, Cartagena, Colombia"
  },
  {
    "kind": "restaurants",
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
    "year": 2025,
    "rank": 50,
    "name": "Jan",
    "city": "Munich",
    "url": "https://www.the50.com/restaurants/best-in-the-world/the-list/restaurant-jan.html",
    "address": "Restaurant JAN, Luisenstraße 27, 80333 Munich, Germany",
    "googlePlaceId": "ChIJrW8egwN1nkcRcSAVCJYQpZY"
  }
]
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "")
/** Verified permanent place IDs first (2026-09-20 official street review); otherwise exact name + street.
 * Ambiguous Hope & Sesame and Celele are deliberately not linked. No Google coordinates/photos stored here. */
export function worldBestFor(name: string, address: string | null | undefined, googlePlaceId?: string | null): WorldBest[] {
  if (googlePlaceId) return WORLD_BEST.filter(r => r.googlePlaceId === googlePlaceId)
  if (!address) return []
  const n = norm(name), a = norm(address)
  return WORLD_BEST.filter(r => {
    const expected = norm(r.name)
    if (n !== expected) return false
    const segments = r.address.split(",").filter(part => /\d/.test(part))
    const words = segments.flatMap(part => part.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]{3,}|\d+/g) ?? [])
    const numbers = new Set(address.match(/\d+/g) ?? [])
    return words.some(w => /^[a-z]{4,}$/.test(w)) && words.every(w => /^\d+$/.test(w) ? numbers.has(w) : a.includes(w))
  })
}
export function worldBestLabel(row: WorldBest): string { return `50 BEST ${row.kind === "bars" ? "BARS" : "RESTAURANTS"} · ${row.year} #${row.rank}` }
