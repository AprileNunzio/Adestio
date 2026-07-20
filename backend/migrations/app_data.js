module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS app_info (
                key_name TEXT PRIMARY KEY,
                key_value TEXT NOT NULL
            );
        `
    },
    {
        version: 2,
        sql: `
            CREATE TABLE IF NOT EXISTS province (
                sigla TEXT PRIMARY KEY,
                nome TEXT NOT NULL
            );
            INSERT OR IGNORE INTO province (sigla, nome) VALUES
                ('TO','Torino'), ('AL','Alessandria'), ('AT','Asti'), ('BI','Biella'), ('CN','Cuneo'), ('NO','Novara'), ('VB','Verbano-Cusio-Ossola'), ('VC','Vercelli'),
                ('AO','Aosta'),
                ('MI','Milano'), ('BG','Bergamo'), ('BS','Brescia'), ('CO','Como'), ('CR','Cremona'), ('LC','Lecco'), ('LO','Lodi'), ('MN','Mantova'), ('MB','Monza e della Brianza'), ('PV','Pavia'), ('SO','Sondrio'), ('VA','Varese'),
                ('TN','Trento'), ('BZ','Bolzano'),
                ('VE','Venezia'), ('BL','Belluno'), ('PD','Padova'), ('RO','Rovigo'), ('TV','Treviso'), ('VR','Verona'), ('VI','Vicenza'),
                ('TS','Trieste'), ('GO','Gorizia'), ('PN','Pordenone'), ('UD','Udine'),
                ('GE','Genova'), ('IM','Imperia'), ('SP','La Spezia'), ('SV','Savona'),
                ('BO','Bologna'), ('FE','Ferrara'), ('FC','Forlì-Cesena'), ('MO','Modena'), ('PR','Parma'), ('PC','Piacenza'), ('RA','Ravenna'), ('RE','Reggio Emilia'), ('RN','Rimini'),
                ('FI','Firenze'), ('AR','Arezzo'), ('GR','Grosseto'), ('LI','Livorno'), ('LU','Lucca'), ('MS','Massa-Carrara'), ('PI','Pisa'), ('PT','Pistoia'), ('PO','Prato'), ('SI','Siena'),
                ('PG','Perugia'), ('TR','Terni'),
                ('AN','Ancona'), ('AP','Ascoli Piceno'), ('FM','Fermo'), ('MC','Macerata'), ('PU','Pesaro e Urbino'),
                ('RM','Roma'), ('FR','Frosinone'), ('LT','Latina'), ('RI','Rieti'), ('VT','Viterbo'),
                ('AQ',"L'Aquila"), ('CH','Chieti'), ('PE','Pescara'), ('TE','Teramo'),
                ('CB','Campobasso'), ('IS','Isernia'),
                ('NA','Napoli'), ('AV','Avellino'), ('BN','Benevento'), ('CE','Caserta'), ('SA','Salerno'),
                ('BA','Bari'), ('BT','Barletta-Andria-Trani'), ('BR','Brindisi'), ('FG','Foggia'), ('LE','Lecce'), ('TA','Taranto'),
                ('PZ','Potenza'), ('MT','Matera'),
                ('RC','Reggio Calabria'), ('CZ','Catanzaro'), ('CS','Cosenza'), ('KR','Crotone'), ('VV','Vibo Valentia'),
                ('PA','Palermo'), ('AG','Agrigento'), ('CL','Caltanissetta'), ('CT','Catania'), ('EN','Enna'), ('ME','Messina'), ('RG','Ragusa'), ('SR','Siracusa'), ('TP','Trapani'),
                ('CA','Cagliari'), ('SS','Sassari'), ('NU','Nuoro'), ('OR','Oristano'), ('SU','Sud Sardegna');
        `
    },
    {
        version: 3,
        sql: `
            CREATE TABLE IF NOT EXISTS nazioni (
                nome TEXT PRIMARY KEY,
                gentilizio TEXT NOT NULL
            );
            INSERT OR IGNORE INTO nazioni (nome, gentilizio) VALUES
                ('Italia','Italiana'), ('Francia','Francese'), ('Germania','Tedesca'), ('Spagna','Spagnola'), ('Portogallo','Portoghese'),
                ('Regno Unito','Britannica'), ('Irlanda','Irlandese'), ('Belgio','Belga'), ('Paesi Bassi','Olandese'), ('Lussemburgo','Lussemburghese'),
                ('Svizzera','Svizzera'), ('Austria','Austriaca'), ('Polonia','Polacca'), ('Repubblica Ceca','Ceca'), ('Slovacchia','Slovacca'),
                ('Ungheria','Ungherese'), ('Slovenia','Slovena'), ('Croazia','Croata'), ('Bosnia ed Erzegovina','Bosniaca'), ('Serbia','Serba'),
                ('Montenegro','Montenegrina'), ('Macedonia del Nord','Macedone'), ('Albania','Albanese'), ('Grecia','Greca'), ('Bulgaria','Bulgara'),
                ('Romania','Rumena'), ('Moldova','Moldava'), ('Ucraina','Ucraina'), ('Bielorussia','Bielorussa'), ('Russia','Russa'),
                ('Lituania','Lituana'), ('Lettonia','Lettone'), ('Estonia','Estone'), ('Finlandia','Finlandese'), ('Svezia','Svedese'),
                ('Norvegia','Norvegese'), ('Danimarca','Danese'), ('Islanda','Islandese'), ('Malta','Maltese'), ('Cipro','Cipriota'),
                ('Stati Uniti','Statunitense'), ('Canada','Canadese'), ('Messico','Messicana'),
                ('Brasile','Brasiliana'), ('Argentina','Argentina'), ('Cile','Cilena'), ('Colombia','Colombiana'), ('Perù','Peruviana'),
                ('Venezuela','Venezuelana'), ('Ecuador','Ecuadoriana'), ('Bolivia','Boliviana'), ('Uruguay','Uruguaiana'), ('Paraguay','Paraguaiana'),
                ('Cuba','Cubana'), ('Repubblica Dominicana','Dominicana'),
                ('Marocco','Marocchina'), ('Algeria','Algerina'), ('Tunisia','Tunisina'), ('Libia','Libica'), ('Egitto','Egiziana'),
                ('Nigeria','Nigeriana'), ('Senegal','Senegalese'), ('Ghana','Ghanese'), ("Costa d'Avorio",'Ivoriana'), ('Mali','Maliana'),
                ('Etiopia','Etiope'), ('Eritrea','Eritrea'), ('Somalia','Somala'), ('Kenya','Keniota'), ('Sudafrica','Sudafricana'),
                ('Camerun','Camerunese'), ('Congo (RD)','Congolese'), ('Gambia','Gambiana'), ('Guinea','Guineana'),
                ('Turchia','Turca'), ('Israele','Israeliana'), ('Libano','Libanese'), ('Siria','Siriana'), ('Giordania','Giordana'),
                ('Iraq','Irachena'), ('Iran','Iraniana'), ('Arabia Saudita','Saudita'), ('Emirati Arabi Uniti','Emiratina'), ('Yemen','Yemenita'),
                ('Afghanistan','Afghana'), ('Pakistan','Pakistana'),
                ('India','Indiana'), ('Cina','Cinese'), ('Giappone','Giapponese'), ('Corea del Sud','Sudcoreana'), ('Corea del Nord','Nordcoreana'),
                ('Vietnam','Vietnamita'), ('Thailandia','Thailandese'), ('Filippine','Filippina'), ('Indonesia','Indonesiana'), ('Malesia','Malese'),
                ('Bangladesh','Bangladese'), ('Sri Lanka','Singalese'), ('Nepal','Nepalese'),
                ('Australia','Australiana'), ('Nuova Zelanda','Neozelandese');
        `
    }
];
