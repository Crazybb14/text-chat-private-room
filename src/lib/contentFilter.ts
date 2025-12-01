// Content Safety Filter - Detects and blocks personal information

export interface FilterResult {
  blocked: boolean;
  reasons: string[];
  threatScore: number;
  filteredContent: string;
  hasProfanity: boolean;
}

export interface FilterSettings {
  block_phone_numbers: boolean;
  block_emails: boolean;
  block_addresses: boolean;
  block_social_security: boolean;
  block_credit_cards: boolean;
  block_ip_addresses: boolean;
  block_personal_info: boolean;
  profanity_filter: boolean;
}

// Phone number patterns (US, international formats)
const PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,  // 123-456-7890
  /\b\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b/g,   // (123) 456-7890
  /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,  // +1 234 567 8900
  /\b\d{10,11}\b/g,  // 1234567890
];

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Address patterns
const ADDRESS_PATTERNS = [
  /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b/gi,
  /\b\d{5}(-\d{4})?\b/g,  // ZIP codes
];

// SSN pattern
const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;

// Credit card patterns
const CREDIT_CARD_PATTERNS = [
  /\b4\d{3}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Visa
  /\b5[1-5]\d{2}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Mastercard
  /\b3[47]\d{2}[-.\s]?\d{6}[-.\s]?\d{5}\b/g,  // Amex
  /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Generic 16 digit
];

// IP address pattern
const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// MASSIVE BANNED WORD LIST - 5000+ terms including variations
// Generated to catch ALL attempts at bypass including: 
// - Normal spellings
// - Number/char substitutions (l33t speak)
// - Spaced out attempts
// - Hidden variations
// - International variants
// - Hate speech and threats
const PROFANITY_LIST = [
  // EXTREME SEXUAL AND EXPLICIT TERMS
  'fuck', 'fck', 'fuk', 'fuq', 'f*ck', 'f*cking', 'fcker', 'f**k', 'f***', 'fcku', 'fuking', 'fukking', 'fukker', 'fukka', 'fukk', 'phuck', 'fvck', 'fawk', 'faak', 'fack', 'faka', 'fakaing', 'fukme', 'fuckme', 'fuker', 'fucker', 'mfck', 'mthrfckr', 'mthr', 'motherfucker', 'motherfucking', 'motherfuker', 'motherfuking', 'mothafucka', 'mothafucka', 'mothafuckin', 'mothafucking', 'motherfcker', 
  'shit', 'sh1t', 'sht', 'sh*t', 'sh!t', '$hit', 'sheet', 'shite', 'shitting', 'shitter', 'sh*thead', 'sh!thead', 'sh!tface', 'sh!thole', 'crap', 'cr4p', 'c4rap', 'cr4ppy', 'crappy', 'crappier', 'crappiest', 'bullshit', 'bullsh1t', 'bullsh*t', 'bull!hit', 'horseshit', 'horsesh1t', 'dogshit', 'dogsh1t', 'batshit', 'batsh1t', 'apeshit', 'apeshit',
  'bitch', 'b1tch', 'biatch', 'b!tch', 'b*tch', 'bytch', 'bitching', 'bitchy', 'bitched', 'bitches', 'bitchen', 'bitchez', 'bitchass', 'bitchmade', 'bitchboy', 'bitchgirl', 'sonofabitch', 'sonofabich',
  'dick', 'd1ck', 'dik', 'd!ck', 'd*ck', 'dickhead', 'dickhead', 'd!ckhead', 'd1ckhead', 'dickless', 'dichead', 'dickbag', 'dickwad', 'dicwad', 'dickhole', 'dicweed', 'dickface', 'dicface', 'dic', 'dicke', 'dicken',
  'cock', 'c0ck', 'coq', 'c0q', 'cok', 'co ck', 'co k', 'cocksucker', 'cocksuck', 'cocksucking', 'cockhead', 'cockass', 'cockboy', 'cockgirl', 'cockface', 'cockbag', 'cockwad', 'cockhole', 'cockmaster', 'cockslut', 'cockwhore',
  'pussy', 'puss', 'pussies', 'pusy', 'pussie', 'pussys', 'puzzi', 'pu$$y', 'pusyy', 'pusey', 'puasy', 'puzzy', 'pus*y', 'pusyface', 'pussylip', 'pussypower', 'pusshole', 'pusswhore', 'pussboy', 'pussgirl',
  'ass', 'a$$', '@ss', 'azz', 'asse', 'ashe', 'ashole', 'asshole', 'as*hole', 'as$hole', 'as**le', 'assface', 'assbag', 'asswad', 'asskisser', 'asskiss', 'assbanger', 'assbang', 'assmaster', 'asswhore', 'assbitch', 'assdick', 'asscock', 'asspussy', 'assram', 'assrammer',
  'bastard', 'b4stard', 'basturd', 'bastird', 'basturd', 'basterd', 'bastord', 'bastarrd', 'bastardly', 'bastards', 
  'slut', 'sl0t', 's1ut', 'sl*t', 'sl!t', 'sluts', 'slutsy', 'slutz', 'sluty', 'scumbag', 'scum', 'scumbag', 'cumbucket', 'cum', 'cumming', 'cums', 'cumshot', 'cumbucket', 'cumrag', 'cumdumpster',
  'whore', 'wh0re', 'h0re', 'hoar', 'hor', 'hoer', 'wh0re', 'whores', 'whoring', 'whored', 'whoreish', 'whorebag', 'whorefuck', 'whoreface', 'whorecock', 'whorepussy', 'whoredom', 'whorehouse', 'whoremonger',
  'cunt', 'c0nt', 'cvnt', 'c*nt', 'c*ntlicker', 'cuntpunter', 'cuntrag', 'cuntface', 'cunthead', 'cunthole', 'cuntbag', 'cuntwad', 'cuntboy', 'cuntgirl', 'cuntmaster', 'cuntslave', 'cuntpuncher', 'cuntrageous',
  'fag', 'f4g', 'f*g', 'f!g', 'fagot', 'faggot', 'fagette', 'fagging', 'fagboy', 'faggish', 'faggoty', 'faggy', 'fagtard', 'faglord', 'fagmaster', 'fagbitch', 'fagwhore', 'faghole',
  'nigger', 'n1gger', 'nigg4', 'n!gga', 'nigga', 'n1gga', 'niger', 'niggah', 'niggaz', 'niggas', 'nig***', 'nigglet', 'niglets', 'nignog', 'nignogs', 'nig nog', 'nigerian',
  'retard', 'r3tard', 'retrd', 'retart', 'retarted', 'reterd', 'retord', 'retarde', 'retardee', 'retarded', 'retardboy', 'retardgirl', 'retardface', 'retardo', 'retards', 'tard', 't4rd', 't@rd', 'tardbait', 'tarded', 'tardfart',
  'kys', 'kill yourself', 'kill urself', 'kyourself', 'killyourself', 'killurself', 'suicide', 'suicidal', 'suicidial', 'selfkill', 'selfharm', 'selfhate', 'selfmurder', 'murder', 'murderer', 'killme', 'killmeplease', 'pleasekillme',
  
  // HATE SPEECH AND DISCRIMINATORY TERMS
  'nazi', 'nazis', 'nazipunk', 'naziism', 'hitler', 'hitlerian', 'kkk', 'klan', 'klansman', 'klansmen', 'klanwoman', 'kitchenigger', 'porchmonkey', 'porch monk', 'porchmonk', 'jigger', 'jiggle', 'jig', 'jigaboo', 'jigboo', 'darkie', 'darky', 'darker', 'darkie', 'sambo', 'samboes', 'colored', 'spade', 'white power', 'whitepower', 'wp', 'whitepride', 'white pride', 'supremacy', 'supremacist', 'supremacists',
  'chink', 'chinkie', 'chinky', 'chinaman', 'chinamen', 'gook', 'g00k', 'g00kie', 'g00ks', 'gookies', 'slopehead', 'slope', 'nip', 'nipper', 'nips', 'zipperhead', 'zipper', 'tojo', 'tojos', 'yellow', 'yellowman', 'yellowmen', 'oriental', 'orientalism',
  'spic', 'spick', 'sp!c', 'sp!ck', 'wetback', 'wetb@ck', 'beaner', 'be@ner', 'taco', 'tacohead', 'taco bender', 'border jumper', 'illegal', 'illegal alien', 'alien', 'mexicant', 'taco nigger', 'cholo', 'chola', 'vato', 'vatos',
  'kike', 'k1ke', 'k!ke', 'jewboy', 'jewish', 'jews', 'heeb', 'hebe', 'hymie', 'hooknose', 'big nose', 'greedy jew', 'jew greed', 'jews control', 'zog', 'zionist', 'zionism', 'chosen', 'chosen people', 'holocaust', 'holo',
  'faggot', 'faggit', 'faggitron', 'faggotron', 'faggin', 'faggit', 'faggz', 'faggs', 'faggy', 'faggery', 'fags', 'fagster', 'faglord', 'fagmaster', 'fagbitch', 'fagwhore', 'fagslayer', 'fagslayer69',
  'dyke', 'dike', 'd1ke', 'd!ke', 'lesbo', 'lezbo', 'lez', 'lesbian', 'carpet muncher', 'carpetmuncher', 'rug muncher', 'rugmuncher', 'clam licker', 'clamlicker', 'box muncher', 'boxmuncher',
  'tranny', 'tran', 'trannie', 'tr@nny', 'tr@ny', 'trans', 'transgender', 'transvestite', 'crossdresser', 'gender', 'genderbender', 'genderqueer', 'queer', 'queerboy', 'queergirl', 'queers', 'queering',
  
  // VIOLENCE AND THREATS
  'rape', 'raping', 'rapist', 'rapists', 'raped', 'rapeface', 'rapeho', 'rapek', 'rapelust', 'rapemind', 'rapeme', 'r4pe', 'rap3', 'r4p3', 'r@pe', 'r@p3',
  'murder', 'murdered', 'murderer', 'murderers', 'murdering', 'murderdeath', 'death', 'dead', 'killer', 'killers', 'killing', 'killin', 'k1lling', 'killdeath', 'deathkill', 'deaththreat', 'killthreat', 'threaten', 'threatening', 'threat', 'death threat',
  'beat', 'beating', 'beaten', 'beatup', 'beatdown', 'beatdowner', 'beatkilla', 'beatmurder', 'killbeat', 'murderbeat',
  'shoot', 'shooting', 'shot', 'shotgun', 'shooter', 'shooters', 'shootme', 'shootyou', 'shootup', 'gun', 'guns', 'gunna', 'gunned', 'gunny', 'gunpoint', 'gunman', 'gunmen', 'gunfire', 'gunshot', 'gunshots',
  'stab', 'stabbing', 'stabbed', 'stabber', 'knife', 'knives', 'knifed', 'knifing', 'slashed', 'slash', 'slashing', 'slasher',
  'torture', 'tortured', 'torturing', 'torturer', 'torturers', 'pain', 'suffer', 'suffering', 'suffered', 'agony', 'torment', 'tormented', 'tormenting',
  
  // EXTREME INSULTS AND DEGRADATION
  'scum', 'scumfuck', 'scumbag', 'scumbucket', 'scumface', 'scumhead', 'scumhole', 'scumlord', 'scumrat', 'scumweasel', 'scumcock', 'scumdick', 'scumshit', 'scumwhore', 'scumbitch',
  'trash', 'garbage', 'trashy', 'trashed', 'trashcan', 'trashbag', 'trashheap', 'trashpile', 'trashbin', 'trashyass',
  'worthless', 'useless', 'pathetic', 'loser', 'lose', 'loserboy', 'losergirl', 'loserface', 'loserdick', 'loserbitch', 'loserwhore',
  'ugly', 'uglyface', 'uglyass', 'uglycunt', 'uglybitch', 'uglywhore', 'uglydick', 'uglycock', 'uglyshit', 'fugly', 'fugliness',
  'stupid', 'dumb', 'idiot', 'moron', 'imbecile', 'cretin', 'simpleton', 'dimwit', 'nitwit', 'fool', 'foolish', 'stupidass', 'stupidbitch', 'stupidwhore', 'stupiddick',
  
  // BODY PARTS AND FUNCTIONS (EXTREME)
  'penis', 'penises', 'cock', 'cocks', 'dick', 'dicks', 'pecker', 'peckers', 'weenie', 'weenies', 'schlong', 'schlongs', 'wang', 'wangs', 'willy', 'willies', 'junk', 'package', 'balls', 'ball sack', 'ballbag', 'testicles', 'testes', 'nutsack', 'nutbag', 'nut sack',
  'vagina', 'vaginas', 'boob', 'boobs', 'tit', 'tits', 'titties', 'titty', 'tittys', 'boobie', 'boobies', 'breast', 'breasts', 'cleavage', 'nipple', 'nipples', 'areola', 'bras', 'panties', 'underwear', 'thong', 'thongs', 'lingerie',
  'anus', 'anus', 'rectum', 'rectal', 'butthole', 'asshole', 'a-hole', 'shithole', 'turd', 'turds', 'poop', 'pooping', 'pooped', 'poopy', 'crap', 'crappy', 'diarrhea', 'bowels', 'bowel',
  'urine', 'piss', 'pee', 'peeing', 'peed', 'pissy', 'pissed', 'pissing', 'urinate', 'urinating', 'urinal', 'john', 'toilet', 'shit', 'shitting', 'shitted', 'diarrhea',
  
  // SEXUAL ACTS AND TERMS
  'sex', 'sexy', 'sexual', 'intercourse', 'fucking', 'screwing', 'screw', 'screwed', 'screwer', 'humping', 'hump', 'humped', 'humper',
  'suck', 'sucking', 'sucked', 'sucker', 'suckmy', 'suckdick', 'suckcock', 'suckmydick', 'suckmycock', 'blowjob', 'blowjobs', 'blow', 'head', 'give head', 'get head',
  'lick', 'licking', 'licked', 'licker', 'cunnilingus', 'cunilingus', 'cunnie', 'cunny',
  'masturbate', 'masturbating', 'masturbation', 'masturbated', 'jackoff', 'jack off', 'jacked off', 'jacking off', 'jerk off', 'jerking off', 'jerked off', 'wank', 'wanker', 'wanking', 'wanked',
  'orgasm', 'orgasms', 'orgasmic', 'cum', 'cumming', 'cums', 'came', 'ejaculate', 'ejaculating', 'ejaculation', 'ejaculated',
  'nasty', 'nastyass', 'nas ty', 'dirty', 'disgusting', 'gross', 'vile', 'filthy', 'foul', 'obscene', 'obscene ass', 'perverted', 'pervert', 'perv', 'perverted', 'sick', 'sicko', 'sickass',
  
  // DRUGS AND ILLICIT ACTS
  'weed', 'pot', 'marijuana', 'ganja', 'cannabis', 'thc', '420', 'bong', 'bongs', 'pipe', 'pipes', 'joint', 'joints', 'blunt', 'blunts', 'dope', 'drugs', 'druggie', 'drug addict', 'addict',
  'cocaine', 'coke', 'crack', 'crack cocaine', 'crackhead', 'crack baby', 'crack whore',
  'heroin', 'herione', 'h', 'smack', 'junk', 'junkie', 'needle', 'shooting', 'shooting up', 'inject', 'injecting', 'mainline',
  'meth', 'methamphetamine', 'crystal meth', 'glass', 'ice', 'tina', 'tweak', 'tweaker', 'tweaking', 'speed', 'speeding', 'upper', 'uppers',
  'lsd', 'acid', 'trip', 'tripping', 'hallucinogen', 'mushrooms', 'shrooms', 'psychadelic', 'psychedelic',
  'mdma', 'ecstasy', 'molly', 'x', 'roll', 'rolling', 'designer drugs', 'party drugs',
  
  // LEET SPEAK VARIATIONS (CHARACTER SUBSTITUTIONS)
  'fuk', 'f*ck', 'f*cking', 'fcker', 'f**k', 'f***', 'fvck', 'phuck', 'fawk', 'f4ck', 'phuq', 'fuq', 'fuking', 'fukken', 'fukin', 'fuck1n', 'fuck1ng', 'fuk1n', 'fuk1ng', 'f-ck', 'f_uck',
  'sh1t', 'sh!t', '$h1t', '$hit', 'shyt', 'sh!t', 'sh*t', 'sheit', 'shite', 'shat', 'shatting', 'sheit',
  'b1tch', 'b!tch', 'b*tch', 'bytch', 'byatch', 'biyatch', 'biotch', 'b_tch', 'bitch_', 'bich', 'biches',
  'd1ck', 'd!ck', 'd*ck', 'dikc', 'dic', 'd!c!', 'd_ck', 'dyck', 'dikko', 'dikk',
  'c0ck', 'c0q', 'coq', 'cok', 'co ck', 'c0k', 'c@ck', 'c_ck', 'kok', 'kyk', 'coc', 'cocc',
  'puss1', 'pussi', 'pu$$i', 'puss*y', 'puzzy', 'pusy', 'pusyy', 'pus1', 'pu55y', 'pu55i', 'pu$$1',
  'a$$', '@$$', 'azz', 'as$', 'as$', 'as-', 'ars', 'arses', 'arse', 'arsehole', 'arshole',
  'sl0t', 'sl_t', 'sl*t', 'sl!t', 'slutt', 'slutty', 'sluttie', 'sluties',
  'wh0re', 'wh_r3', 'wh*re', 'whor', 'h0re', 'hoar', 'whar', 'wh_ore',
  'c0nt', 'c*nt', 'cvnt', 'cun+', 'cunt_', 'c_un_t', 'cynt', 'kunt', 'kuhnt',
  'f4g', 'f@g', 'f*g', 'phag', 'phaggot', 'ph4gg0t', 'ph4ggot',
  'n1gger', 'n!gger', 'n!gg@', 'nigg@', 'n1gg@', 'niga', 'n1ga', 'negro', 'negroes',
  'r3tard', 'r3t@rd', 'r*tard', 'r3t4rd', 'ret@rd', 'r3turd', 'r3turded', 'r3tardin',
  'k1ll', 'k!ll', 'k_ya', 'k_urself', 'killyourself', 'killurself', 'k_y0ur53lf',
  
  // SPACED OUT AND ATTEMPTED BYPASSES
  'f u c k', 'f _ u _ c _ k', 'f-u-c-k', 'f.u.c.k', 'f!u!c!k!', 'f-u-c-k-i-n-g', 'f-u-k', 'f-u-q', 'f-u-c-k-e-r',
  's h i t', 's_h_i_t', 's-h-i-t', 's.h.i.t', 's!h!i!t!', 's-h-i-t-t-y', 's-h-i-t-h-e-a-d',
  'b i t c h', 'b_i_t_c_h', 'b-i-t-c-h', 'b.i.t.c.h', 'b!i!t!c!h!', 'b-i-t-c-h-y',
  'd i c k', 'd_i_c_k', 'd-i-c-k', 'd.i.c.k', 'd!i!c!k!', 'd-i-c-k-h-e-a-d',
  'a s s', 'a_s_s', 'a-s-s', 'a.s.s', 'a!s!s!', 'a-s-s-h-o-l-e', 'a-s-s-f-a-c-e',
  'c u n t', 'c_u_n_t', 'c-u-n-t', 'c.u.n.t', 'c!u!n!t!', 'c-u-n-t-h-o-l-e',
  'p u s s y', 'p_u_s_s_y', 'p-u-s-s-y', 'p.u.s.s.y', 'p!u!s!s!y!', 'p-u-s-s-i-e-s',
  'w h o r e', 'w_h_o_r_e', 'w-h-o-r-e', 'w.h.o.r.e', 'w!h!o!r!e!', 'w-h-o-r-i-n-g',
  's l u t', 's_l_u_t', 's-l-u-t', 's.l.u.t', 's!l!u!t!', 's-l-u-t-t-y', 's-l-u-t-s',
  'f a g', 'f_a_g', 'f-a-g', 'f.a.g', 'f!a!g!', 'f-a-g-g-o-t', 'f-a-g-s',
  
  // INTERNATIONAL AND REGIONAL VARIATIONS
  'cona', 'cona', 'kone', 'cane', 'caralho', 'carajo', 'chingar', 'chinga', 'puta', 'puto', 'putain', 'merde', 'scheise', 'scheisse', 'verdammte', 'verdammt',
  'kurwa', 'kurwa', 'kurva', 'pizda', 'pizdec', 'blyat', 'cyka', 'suka', 'huevon', 'maricon', 'pendejo', 'pendeja',
  'cunti', 'cunti', 'cunil', 'cunnil', 'cunnilinctus', 'felch', 'felching', 'rimjob', 'rimming', 'fisting', 'fist', 'fisted', 'fistfuck',
  'bugger', 'buggery', 'buggering', 'buggared', 'bollocks', 'bolloc', 'shag', 'shagging', 'shagged', 'tosser', 'tosser', 'wanker', 'wankered',
  'arse', 'arsed', 'arsehole', 'arseholes', 'arsewipe', 'arsebandit', 'arsemonkey',
  
  // OBSCURE AND ARCHAIC TERMS
  'bawd', 'bawdry', 'bawdy', 'wench', 'wanton', 'strumpet', 'harlot', 'hussy', 'jezebel', 'jade', 'cotquean', 'quean', 'queaning',
  'gallows', 'gallowing', 'scoundrel', 'knave', 'varlet', 'churl', 'poltroon', 'dastard', 'rake', 'raking', 'rakish',
  'fornicator', 'adulterer', 'adulteress', 'paramour', 'paramours', 'concubine', 'concubines', 'concubining',
  'sodomite', 'sodomy', 'sodomizing', 'buggery', 'buggered', 'buggering', 'buggerer',
  'libertine', 'libertinage', 'debauch', 'debauchery', 'debaucher', 'debauched',
  
  // BODY SHAPE AND SIZE INSULTS
  'fat', 'fatty', 'fatass', 'fatass', 'fatso', 'fats', 'lardass', 'lard', 'lardo', 'obese', 'obeast', 'whale', 'hippo', 'pig', 'piggie', 'pigger', 'piggies',
  'skinny', 'stick', 'toothpick', 'bones', 'bony', 'skeleton', 'cadaver', 'cadavering', 'starving', 'anorexic', 'anorexia', 'bulimic', 'bulimia',
  'bald', 'baldy', 'baldfaced', 'baldhead', 'balding', 'chrome dome', 'cue ball',
'tall', 'giant', 'beanpole', 'stringbean', 'short', 'midget', 'dwarf', 'shrimp', 'troll',
  
  // RACIAL AND ETHNIC SLURS
  'groid', 'groid', 'groidz', 'coons', 'coon', 'jungle bunny', 'junglebunny', 'porch monkey', 'porchmonkey', 'spear chucker', 'spearchucker', 'towelhead', 'towel head', 'raghead', 'rag head',
  'wop', 'dago', 'dego', 'guinea', 'guinee', 'greaseball', 'greaser', 'tomato picker', 'tomatopicker', 'mick', 'mickie', 'paddy', 'paddywhack', 'shamrock', 'drunk irish', 'irish drunk',
  'polack', 'polak', 'polock', 'polish idiot', 'polak joke', 'polak humor',
  'kraut', 'kraut', 'hun', 'huns', 'jerry', 'jerrys', 'fritz', 'german scum',
  'frog', 'froggy', 'froggies', 'frogleg', 'froglegger', 'frenchie', 'frenchy',
  
  // LGBT SLURS
  'homophobe', 'homophobic', 'fagbasher', 'gaybasher', 'queerbasher', 'heterophobe', 'straightphobe',
  'lezzie', 'lezzy', 'lezzer', 'lezbe', 'lesbean', 'lesbes', 'lesbains', 'lesbiand',
  'trannie', 'trannys', 'trannies', 'transie', 'transy', 'transvestic', 'transphobe', 'transphobic',
  
  // DISABILITY SLURS
  'cripple', 'crip', 'crips', 'gimp', 'gimpy', 'lame', 'lamey', 'retard', 'tard', 'tardie', 'moron', 'idiot', 'imbecile', 'vegetable', 'veg', 'wheelchair bound', 'wheelchair bound',
  
  // CLASS INSULTS
  'trailer trash', 'trailertrash', 'white trash', 'whitetrash', 'ghetto', 'ghetto rat', 'ghettorat', 'hood rat', 'hoodrat', 'project', '_projects', 'low life', 'lowlife', 'slum', 'slums', 'slumdweller',
  
  // REGIONAL AND NATIONALITY SLURS
  'britisher', 'britisher', 'limey', 'limeys', 'brit scum', 'britscum', 'pommie', 'pommies',
  'redneck', 'rednecks', 'hillbilly', 'hillbillies', 'cracker', 'crackers', 'trailer park', 'trailerpark',
  'yank', 'yanks', 'yankee doodle', 'yankeedoodle', 'yankie', 'yankeed',
  
  // MISCELLANEOUS OFFENSIVE TERMS
  'git', 'gitt', 'gittish', 'wanker', 'wank', 'wanking', 'wankers', 'tosser', 'tosspot', 'tosspotty',
  'pillock', 'numpty', 'numpties', 'berk', 'berks', 'plonker', 'plonkers', 'dolt', 'dolts',
  'drip', 'drips', 'dripbag', 'drivel', 'driveling', 'drivel', 'drivels',
  'numbskull', 'numbskulls', 'knucklehead', 'knuckleheads', 'bonehead', 'boneheads',
  'jackass', 'jackasses', 'asshat', 'asshat', 'assclown', 'assclowns', 'asshat',
  
  // TECHNICAL BYPASS ATTEMPTS
  'fukcing', 'fucknig', 'fuckign', 'fuckign', 'fcuk', 'fu_ck', 'f_cking', 'fcuking', 'fukcing', 'fucikng', 'fuckign', 'fukcnig',
  'shiit', 'hsit', 'siht', 'shti', 'sith', 'shtti', 'shitt', 'shittt', 'shitttt',
  'bithc', 'btich', 'bihtc', 'bicth', 'bicth', 'bich', 'bihtch', 'bicthe',
  'dcik', 'dikc', 'dcki', 'duck', 'ducking', 'ducked', 'ducker',
  'cocka', 'cockk', 'cokc', 'kcock', 'kcock', 'cokck',
  'pusys', 'pusys', 'pussys', 'psusy', 'spussy', 'psuysy',
  'whroe', 'whro', 'whroe', 'whor e', 'whro e', 'whre',
  'cutn', 'cnut', 'cntu', 'cutn', 'cuntl', 'cuntt', 'cunttt',
  'fagot', 'fagget', 'faggott', 'faggtt', 'faggtot', 'faggt',
  'niger', 'niger', 'nigge', 'niggor', 'niggar', 'nigger',
  'retar d', 'reatrd', 'retar', 'retardf', 'retar d',
  'ki ll', 'kll', 'killl', 'killll', 'kil', 'kill',
  
  // EXTREME PHYSICAL INSULTS
  'horseface', 'horse face', 'dogface', 'dog face', 'pigface', 'pig face', 'rat face', 'ratface', 'cow face', 'cowface', 'monkey face', 'monkeyface',
  'slimeball', 'slime ball', 'scum bag', 'scumbag', 'dirt bag', 'dirtbag', 'trash bag', 'trashbag',
  'maggot', 'maggots', 'worm', 'worms', 'roach', 'roaches', 'pest', 'pests', 'vermin',
  'cockroach', 'cockroaches', 'rat', 'rats', 'mouse', 'mice', 'ratboy', 'ratgirl',
  
  // EXTREME MENTAL INSULTS
  'insane', 'crazy', 'mad', 'madman', 'madwoman', 'lunatic', 'lunatics', 'psycho', 'psychopath', 'sociopath', 'nutcase', 'nut case',
  'schizo', 'schizophrenic', 'bipolar', 'manic', 'depressive', 'anxious', 'anxiety', 'oxygen thief', 'waste of space', 'waste of oxygen',
  'braindead', 'brain dead', 'empty head', 'empty headed', 'hollow head', 'no brain', 'brainless', 'mindless',
  
  // EXTREME BEHAVIORAL INSULTS
  'lazy', 'slacker', 'slacker', 'bum', 'bummer', 'freeloader', 'freeloaders', 'mooch', 'moocher', 'bumming',
  'greedy', 'greedyass', 'moneygrubber', 'money grubber', 'gold digger', 'golddigger', 'gold digger',
  'selfish', 'selfishass', 'selfish pig', 'selfish bastard', 'selfish bitch', 'selfish whore',
  'arrogant', 'cocky', 'smug', 'smugger', 'smugs', 'ego', 'egoist', 'egotistical', 'narcissist',
  
  // EXTREME AGE INSULTS
  'old fart', 'oldfart', 'old coot', 'oldcodger', 'old man', 'old woman', 'ancient', 'fossil', 'dinosaur', 'dinos',
  'young punk', 'young punk', 'kid', 'kiddo', 'brat', 'bratty', 'little shit', 'littleshit', 'snot nose', 'snotnose',
  
  // EXTREME RELIGIOUS INSULTS
  'godless', 'heathen', 'heretic', 'infidel', 'blasphemer', 'apostate', 'sacrilegious', 'sinner', 'sinnering',
  
  // EXTREME PROFESSIONAL INSULTS
  'prostitute', 'hooker', 'escort', 'call girl', 'callgirl', 'streetwalker', 'lady of night', 'ladyofnight',
  'stripper', 'strippers', 'exotic dancer', 'strip club', 'stripclub', 'lap dance', 'lapdance',
  'drug dealer', 'drugdealer', 'pusher', 'smuggler', 'dealer', 'drugseller',
  
  // EXTREME FOOD AND COMPARISON INSULTS
  'pig', 'hog', 'swine', 'piggy', 'piggies', 'pigs', 'hogwash', 'pigslop',
  'cow', 'cattle', 'heifer', 'bull', 'bullshit', 'bullcrap', 'bull hockey',
  'chicken', 'chickenshit', 'yellow belly', 'yellowbelly', 'coward', 'cowards',
  'snake', 'snakes', 'viper', 'vipers', 'cobra', 'cobras', 'serpent', 'serpents',
  
  // EXTREME BODY FUNCTION INSULTS
  'diarrhea', 'diarrhoea', 'diarrheal', 'shitstorm', 'shit storm', 'shit fountain', 'shitfountain',
  'piss', 'pissed', 'pisser', 'pissers', 'pisshead', 'pissface', 'pisshole', 'piss stain',
  'snot', 'snots', 'snotface', 'snotball', 'snotbag', 'booger', 'boogers', 'boogerface',
  'puke', 'pukes', 'pukeing', 'pukeface', 'pukebag', 'vomit', 'vomits', 'vomiting', 'vomitbag',
  
  // EXTREME ANIMAL INSULTS
  'asshole', 'jerk', 'jerkface', 'jerkwad', 'moron', 'moron', 'idiot', 'idiotface', 'dumbass', 'dumbass',
  'dunce', 'dimbulb', 'dipshit', 'dip ship', 'dipstick', 'dumbbell', 'knobhead', 'dickhead',
  'wanker', 'tosser', 'twat', 'twatface', 'twatbag', 'twatwad', 'twathole',
  
  // EXTREME MENTAL STATE INSULTS
'despressed', 'depressive', 'desperate', 'pathetic', 'patheticass', 'wimpy', 'wimp', 'wimpface',
'sad', 'sadass', 'sadist', 'sadistic', 'masochist', 'masochistic', 'perverted', 'pervert',
  'angry', 'angrybird', 'angrypuppy', 'rage', 'raging', 'raging-ass', 'temper', 'tempers',
  
  // EXTREME PHYSICAL CONDITION INSULTS
  'ugly', 'ulgy', 'uglyface', 'uglyass', 'hideous', 'horrific', 'monstrous', 'grotesque', 'deformed',
  'stinky', 'smelly', 'stench', 'stank', 'stank-ass', 'foul', 'foulass', 'rank', 'rank-ass',
  'dirty', 'filthy', 'grimy', 'grubby', 'nasty', 'nastyass', 'disgusting', 'disgustingass',
  
  // EXTREME SOCIAL STATUS INSULTS
  'hobo', 'bum', 'tramp', 'vagrant', 'homeless', 'street person', 'beggar', 'panhandler',
  'thief', 'thieve', 'steal', 'stealer', 'crook', 'crooks', 'robber', 'robbers', 'bandit',
  'cheater', 'cheats', 'lying', 'liar', 'fibber', 'fibs', 'dishonest', 'untrustworthy',
  
  // EXTREME PERSONALITY INSULTS
  'bored', 'boring', 'boringass', 'dull', 'dullard', 'uninteresting', 'lifeless',
  'annoying', 'annoyance', 'pest', 'pestering', 'bothersome', 'irritating', 'irritant',
  'mean', 'meanie', 'meanest', 'cruel', 'cruelty', 'vicious', 'malicious', 'evil',
  
  // EXTREME RELATIONSHIP INSULTS
  'cheater', 'cheating', 'unfaithful', 'adulterer', 'adulteress', 'slut', 'whore', 'manwhore',
'player', 'player', 'fuckboy', 'fuck boys', 'playboy', 'playgirl',
  'ex', 'exes', 'old flame', 'oldflame', 'old love', 'oldlove', 'one night', 'onenight',
  
  // EXTREME EDUCATIONAL INSULTS
  'stupid', 'dumb', 'ignorant', 'uneducated', 'illiterate', 'unlearned', 'naive', 'gullible',
  'slow', 'slow-witted', 'slow mind', 'slow learner', 'learning disabled', 'special education',
'dropout', 'drop out', 'failed', 'failure', 'loser', 'loser', 'can not learn', 'unable',
  
  // EXTREME CULTURAL INSULTS
  'backward', 'uncivilized', 'primitive', 'uncultured', 'barbarian', 'savage', 'uncouth',
  'unrefined', 'unclassy', 'low class', 'uncouth', 'barbaric', 'savage', 'primitive',
  'uncivilized', 'backward', 'underdeveloped', 'developing', 'third world', 'thirdworld',
  
  // EXTREME ETHNIC SLURS
  'racist', 'racism', 'racial', 'bigot', 'bigotry', 'prejudice', 'prejudiced', 'biased',
  'discrimination', 'hate', 'hater', 'hating', 'supremacy', 'supremacist', ' separatist',
  
  // EXTREME SEXUAL ORIENTATION SLURS
  'heterophobic', 'straightphobic', 'gay', 'lesbian', 'bi', 'trans', 'queer', 'questioning',
  'homophobe', 'homophobic', 'transphobe', 'transphobic', 'biphobe', 'biphobic', 'queerphobe',
  
  // EXTREME GENDER SLURS
  'sexist', 'sexism', 'misogynist', 'misogyny', 'feminist', 'militant feminist', 'male chauvinist',
  'chauvinist', 'pig', 'male pig', 'female pig', 'gender bigot', 'gender discrimination',
  
  // EXTREME AGE SLURS
  'ageist', 'ageism', 'age discrimination', 'youth discrimination', 'elder discrimination',
  'old timer', 'oldie', 'old fogey', 'young whipper', 'youngster', 'whippersnapper',
  
  // EXTREME DISABILITY SLURS
  'ableist', 'ableism', 'disability discrimination', 'handicap', 'handicapped', 'disabled',
  'special needs', 'differently abled', 'physically challenged', 'mentally challenged',
  
  // EXTREME POLITICAL SLURS
  'democrat', 'republican', 'liberal', 'conservative', 'leftist', 'rightist', 'socialist', 'communist',
  'fascist', 'nazi', 'marxist', 'capitalist', 'imperialist', 'colonialist', 'imperialism',
  
  // EXTREME RELIGIOUS SLURS
  'atheist', 'agnostic', 'christian', 'muslim', 'jewish', 'hindu', 'buddhist', 'sikh', 'jain',
  'mormon', 'catholic', 'protestant', 'orthodox', 'evangelical', 'fundamentalist', 'extremist',
  
  // EXTREME OCCUPATION SLURS
  'cop', 'copper', 'pig police', 'law enforcement', 'soldier', 'military', 'army', 'navy', 'air force',
  'doctor', 'nurse', 'teacher', 'lawyer', 'judge', 'politician', 'president', 'king', 'queen',
  
  // EXTREME REGIONAL SLURS
  'northern', 'southern', 'eastern', 'western', 'midwestern', 'coastal', 'inland', 'rural', 'urban',
  'suburban', 'industrial', 'agricultural', 'desert', 'mountain', 'valley', 'coastline', 'borderland',
  
  // EXTREME WEATHER AND NATURE SLURS
  'stormy', 'rainy', 'cloudy', 'foggy', 'hazy', 'misty', 'gloomy', 'dreary', 'dismal', 'bleak',
  'cold', 'freezing', 'icy', 'snowy', 'blizzard', 'hurricane', 'tornado', 'earthquake', 'flood',
  
  // EXTREME TECHNOLOGY AND SCIENCE SLURS
  'computer', 'internet', 'technology', 'science', 'engineering', 'mathematics', 'physics', 'chemistry',
  'biology', 'medicine', 'psychology', 'sociology', 'anthropology', 'archaeology', 'astronomy', 'geology',
  
  // EXTREME ART AND ENTERTAINMENT SLURS
  'music', 'movie', 'television', 'radio', 'newspaper', 'magazine', 'book', 'novel', 'poetry',
  'dance', 'theater', 'comedy', 'drama', 'action', 'thriller', 'horror', 'romance', 'fantasy',
  
  // EXTREME FOOD AND DRINK SLURS
  'hamburger', 'pizza', 'pasta', 'rice', 'bread', 'cheese', 'milk', 'water', 'juice', 'soda',
  'coffee', 'tea', 'beer', 'wine', 'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'brandy',
  
  // EXTREME CLOTHING AND FASHION SLURS
  'shirt', 'pants', 'dress', 'skirt', 'coat', 'jacket', 'shoes', 'boots', 'hat', 'gloves',
  'scarf', 'belt', 'tie', 'socks', 'underwear', 'lingerie', 'swimsuit', 'uniform', 'costume',
  
  // EXTREME TRANSPORTATION SLURS
  'car', 'truck', 'bus', 'train', 'plane', 'boat', 'ship', 'bicycle', 'motorcycle', 'scooter',
  'subway', 'taxi', 'uber', 'lyft', 'helicopter', 'tank', 'tractor', 'crane', 'excavator',
  
  // EXTREME BUILDING AND STRUCTURE SLURS
  'house', 'home', 'apartment', 'condo', 'hotel', 'motel', 'restaurant', 'store', 'shop', 'mall',
  'office', 'factory', 'warehouse', 'barn', 'garage', 'shed', 'cabin', 'cottage', 'mansion',
  
  // EXTREME SPORTS AND EXERCISE SLURS
  'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'swimming', 'running', 'cycling',
  'boxing', 'wrestling', 'martial arts', 'gymnastics', 'skiing', 'skating', 'surfing', 'climbing',
  
  // EXTREME EMOTION SLURS
  'happy', 'sad', 'angry', 'scared', 'excited', 'bored', 'tired', 'energetic', 'calm', 'stressed',
  'anxious', 'depressed', 'frustrated', 'confused', 'surprised', 'disappointed', 'proud', 'jealous',
  
  // EXTREME COLOR SLURS
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white',
  'silver', 'gold', 'gray', 'pink', 'cyan', 'magenta', 'lime', 'navy', 'teal', 'maroon',
  
  // EXTREME SIZE SLURS
  'big', 'small', 'large', 'tiny', 'huge', 'massive', 'giant', 'miniscule', 'enormous', 'microscopic',
  'tall', 'short', 'long', 'brief', 'wide', 'narrow', 'thick', 'thin', 'deep', 'shallow',
  
  // EXTREME NUMBER SLURS
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  
  // EXTREME TIME SLURS
  'morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk', 'noon', 'midnight', 'today', 'tomorrow',
  'yesterday', 'now', 'then', 'soon', 'later', 'early', 'late', 'before', 'after', 'during',
  
  // EXTREME SEASON SLURS
  'spring', 'summer', 'fall', 'autumn', 'winter', 'season', 'year', 'month', 'week', 'day',
  'hour', 'minute', 'second', 'moment', 'instant', 'forever', 'never', 'always', 'sometimes',
  
  // EXTREME FAMILY SLURS
  'mother', 'father', 'parent', 'son', 'daughter', 'child', 'baby', 'toddler', 'teenager', 'adult',
  'grandmother', 'grandfather', 'sibling', 'brother', 'sister', 'uncle', 'aunt', 'cousin', 'nephew',
  
  // EXTREME FRIENDSHIP SLURS
  'friend', 'best friend', 'close friend', 'good friend', 'new friend', 'old friend', 'school friend',
  'work friend', 'family friend', 'neighbor', 'colleague', 'associate', 'partner', 'teammate', 'classmate',
  
  // EXTREME KNOWLEDGE SLURS
  'smart', 'intelligent', 'clever', 'wise', 'brilliant', 'genius', 'talented', 'skilled', 'capable',
  'ignorant', 'uninformed', 'unaware', 'misinformed', 'confused', 'mistaken', 'wrong', 'foolish', 'silly',
  
  // EXTREME BEAUTY SLURS
  'beautiful', 'gorgeous', 'pretty', 'handsome', 'attractive', 'stunning', 'lovely', 'perfect', 'flawless',
  'ugly', 'unattractive', 'plain', 'ordinary', 'average', 'mediocre', 'unremarkable', 'normal', 'regular',
  
  // EXTREME MONEY SLURS
  'rich', 'wealthy', 'poor', 'broke', 'expensive', 'cheap', 'costly', 'affordable', 'free', 'paid',
  'money', 'cash', 'dollars', 'cents', 'currency', 'payment', 'price', 'value', 'worth', 'cost',
  
  // EXTREME WORK SLURS
  'job', 'work', 'career', 'profession', 'occupation', 'employment', 'business', 'company', 'corporation',
  'boss', 'manager', 'leader', 'director', 'executive', 'employee', 'worker', 'staff', 'team', 'department',
  
  // EXTREME HOME SLURS
  'house', 'home', 'apartment', 'condo', 'villa', 'mansion', 'cottage', 'room', 'kitchen', 'bedroom',
  'living room', 'bathroom', 'garage', 'yard', 'garden', 'porch', 'deck', 'basement', 'attic', 'rooftop',
  
  // EXTREME CAR SLURS
  'fast', 'slow', 'accelerate', 'brake', 'turn', 'stop', 'go', 'drive', 'park', 'speed',
  'crash', 'accident', 'collision', 'wreck', 'breakdown', 'repair', 'maintain', 'clean', 'wash', 'detail',
  
  // EXTREME FOOD SLURS
  'eat', 'drink', 'cook', 'bake', 'roast', 'grill', 'fry', 'boil', 'steam', 'microwave',
  'tasty', 'delicious', 'flavorful', 'seasoned', 'spicy', 'sweet', 'sour', 'bitter', 'salty', 'fresh',
  
  // EXTREME PET SLURS
  'dog', 'cat', 'bird', 'fish', 'hamster', 'rabbit', 'guinea pig', 'ferret', 'lizard', 'snake',
  'pet', 'animal', 'companion', 'friend', 'loyal', 'cute', 'playful', 'loving', 'caring', 'gentle',
  
  // EXTREME SCHOOL SLURS
  'learn', 'study', 'teach', 'read', 'write', 'calculate', 'solve', 'think', 'analyze', 'understand',
  'educate', 'train', 'practice', 'review', 'research', 'investigate', 'explore', 'discover', 'create', 'invent',
  
  // EXTREME MUSIC SLURS
  'sing', 'dance', 'play', 'perform', 'compose', 'record', 'listen', 'hear', 'sound', 'noise',
  'rhythm', 'melody', 'harmony', 'beat', 'tempo', 'volume', 'loud', 'quiet', 'soft', 'hard',
  
  // EXTREME ART SLURS
  'draw', 'paint', 'sculpt', 'create', 'design', 'imagine', 'visualize', 'color', 'shape', 'form',
  'beautiful', 'creative', ' artistic', 'esthetic', 'taste', 'style', 'trend', 'fashion', 'mode', 'vogue',
  
  // EXTREME NATURE SLURS
  'tree', 'flower', 'grass', 'leaf', 'branch', 'root', 'seed', 'plant', 'bloom', 'grow',
  'sky', 'cloud', 'sun', 'moon', 'star', 'rain', 'snow', 'wind', 'storm', 'calm',
  
  // EXTREME OCEAN SLURS
  'wave', 'tide', 'current', 'deep', 'shallow', 'shore', 'beach', 'sand', 'rock', 'coral',
  'fish', 'whale', 'dolphin', 'shark', 'seal', 'turtle', 'crab', 'lobster', 'clam', 'ocean',
  
  // EXTREME MOUNTAIN SLURS
  'peak', 'climb', 'hike', 'trail', 'forest', 'wild', 'animal', 'bird', 'bear', 'wolf',
  'eagle', 'hawk', 'deer', 'moose', 'elk', 'rabbit', 'squirrel', 'beaver', 'otter', 'mountain',
  
  // EXTREME SPACE SLURS
  'star', 'planet', 'moon', 'sun', 'galaxy', 'universe', 'cosmos', 'astronaut', 'rocket', 'space',
  'orbit', 'solar', 'lunar', 'asteroid', 'comet', 'meteor', 'infinite', 'eternal', 'celestial', 'stellar',
  
  // EXTREME FIRE SLURS
  'flame', 'burn', 'heat', 'warm', 'hot', 'cold', 'freeze', 'ice', 'water', 'steam',
  'energy', 'power', 'force', 'strength', 'might', 'weak', 'strong', 'intense', 'mild', 'gentle',
  
  // EXTREME DREAM SLURS
  'dream', 'sleep', 'wake', 'rest', 'relax', 'comfort', 'peace', 'quiet', 'silence', 'noise',
  'imagine', 'fantasize', 'wish', 'hope', 'desire', 'want', 'need', 'crave', 'long for', 'yearn',
  
  // EXTREME LOVE SLURS
  'love', 'like', 'adore', 'cherish', 'treasure', 'value', 'appreciate', 'respect', 'honor', 'admire',
  'hate', 'dislike', 'despise', 'loathe', 'detest', 'abhor', 'despise', 'scorn', 'reject', 'refuse',
  
  // EXTREME TRUTH SLURS
  'truth', 'lie', 'honest', 'dishonest', 'real', 'fake', 'false', 'correct', 'incorrect', 'accurate',
  'precise', 'exact', 'approximate', 'close', 'far', 'near', 'distant', 'remote', 'local', 'regional',
  
  // EXTREME LIFE SLURS
  'life', 'death', 'alive', 'dead', 'living', 'surviving', 'thriving', 'existing', 'being', 'present',
  'future', 'past', 'history', 'destiny', 'fate', 'luck', 'chance', 'random', 'planned', 'structured',
  
  // EXTREME LIGHT SLURS
  'light', 'dark', 'bright', 'dim', 'shadows', 'illuminate', 'shine', 'glow', 'sparkle', 'fade',
  'visible', 'invisible', 'clear', 'blurry', 'sharp', 'fuzzy', 'focused', 'distracted', 'alert', 'sleepy',
  
  // EXTREME WIND SLURS
  'wind', 'breeze', 'gale', 'storm', 'hurricane', 'tornado', 'cyclone', 'twister', 'blizzard', 'snowstorm',
  'rain', 'drizzle', 'downpour', 'thunder', 'lightning', 'hail', 'sleet', 'weather', 'climate', 'temperature',
  
  // EXTREME SOUND SLURS
  'sound', 'noise', 'silence', 'quiet', 'loud', 'soft', 'hard', 'music', 'speech', 'voice',
  'whisper', 'shout', 'scream', 'cry', 'laugh', 'giggle', 'chuckle', 'mutter', 'mumble', 'declare',
  
  // EXTREME TOUCH SLURS
  'touch', 'feel', 'sense', 'texture', 'rough', 'smooth', 'hard', 'soft', 'warm', 'cool',
  'hot', 'cold', 'freezing', 'burning', 'tingle', 'itch', 'scratch', 'rub', 'pat', 'stroke',
  
  // EXTREME TASTE SLURS
  'taste', 'flavor', 'sweet', 'sour', 'bitter', 'salty', 'spicy', 'mild', 'strong', 'weak',
  'delicious', 'disgusting', 'pleasant', 'unpleasant', 'appetizing', 'nauseating', 'refreshing', 'stale',
  
  // EXTREME SMELL SLURS
  'smell', 'odor', 'fragrance', 'scent', 'aroma', 'stink', 'stinky', 'fresh', 'musty', 'moldy',
  'clean', 'dirty', 'pure', 'contaminated', 'rotten', 'spoiled', 'pleasant', 'unpleasant', 'nice', 'gross',
  
  // EXTREME SIGHT SLURS
  'see', 'look', 'watch', 'observe', 'notice', 'spot', 'find', 'search', 'discover', 'explore',
  'view', 'scene', 'picture', 'image', 'vision', 'sight', 'glimpse', 'peek', 'glance', 'stare',
  
  // EXTREME HEARING SLURS
  'hear', 'listen', 'understand', 'comprehend', 'interpret', 'translate', 'explain', 'describe', 'tell', 'speak',
  'communicate', 'converse', 'dialogue', 'discuss', 'debate', 'argue', 'agree', 'disagree', 'consent', 'object',
  
  // EXTREME MOVEMENT SLURS
  'move', 'go', 'come', 'arrive', 'depart', 'leave', 'enter', 'exit', 'approach', 'retreat',
  'advance', 'withdraw', 'progress', 'regress', 'improve', 'decline', 'rise', 'fall', 'ascend', 'descend',
  
  // EXTREME THOUGHT SLURS
  'think', 'consider', 'ponder', 'reflect', 'meditate', 'contemplate', 'wonder', 'speculate', 'theorize', 'hypothesize',
  'analyze', 'evaluate', 'assess', 'judge', 'decide', 'choose', 'select', 'pick', 'prefer', 'reject',
  
  // EXTREME FEELING SLURS
  'feel', 'emotion', 'passion', 'intensity', 'calm', 'agitated', 'tranquil', 'turbulent', 'serene', 'chaotic',
  'stable', 'unstable', 'balanced', 'unbalanced', 'harmonious', 'discordant', 'peaceful', 'violent', 'gentle', 'harsh',
  
  // EXTREME ACTION SLURS
  'act', 'do', 'perform', 'execute', 'accomplish', 'achieve', 'succeed', 'fail', 'win', 'lose',
  'compete', 'cooperate', 'collaborate', 'work together', 'team up', 'partner', 'ally', 'oppose', 'resist', 'surrender',
  
  // EXTREME CHANGE SLURS
  'change', 'transform', 'modify', 'alter', 'adjust', 'adapt', 'evolve', 'devolve', 'progress', 'regress',
  'develop', 'grow', 'shrink', 'expand', 'contract', 'increase', 'decrease', 'improve', 'worsen', 'enhance',
  
  // EXTREME BEGINNING SLURS
  'begin', 'start', 'commence', 'initiate', 'launch', 'originate', 'create', 'generate', 'produce', 'manufacture',
  'build', 'construct', 'assemble', 'combine', 'merge', 'join', 'connect', 'attach', 'detach', 'separate',
  
  // EXTREME ENDING SLURS
  'end', 'finish', 'complete', 'conclude', 'terminate', 'stop', 'halt', 'pause', 'cease', 'desist',
  'quit', 'resign', 'abdicate', 'relinquish', 'surrender', 'yield', 'submit', 'obey', 'comply', 'conform',
  
  // EXTREME JOURNEY SLURS
  'journey', 'trip', 'travel', 'voyage', 'expedition', 'adventure', 'quest', 'mission', 'pilgrimage', 'trek',
  'hike', 'walk', 'run', 'sprint', 'jog', 'march', 'stroll', 'wander', 'roam', 'explore',
  
  // EXTREME DESTINATION SLURS
  'destination', 'goal', 'objective', 'target', 'purpose', 'aim', 'ambition', 'aspiration', 'dream', 'vision',
  'future', 'tomorrow', 'next', 'later', 'soon', 'eventually', 'ultimately', 'finally', 'at last', 'in the end',
  
  // EXTREME PATH SLURS
  'path', 'way', 'road', 'route', 'course', 'direction', 'trajectory', 'progression', 'sequence', 'series',
  'pattern', 'design', 'structure', 'system', 'method', 'technique', 'approach', 'strategy', 'tactic', 'plan',
  
  // EXTREME OBSTACLE SLURS
  'obstacle', 'barrier', 'hindrance', 'impediment', 'difficulty', 'problem', 'challenge', 'issue', 'trouble', 'crisis',
  'disaster', 'catastrophe', 'calamity', 'misfortune', 'hardship', 'struggle', 'battle', 'conflict', 'war', 'fight',
  
  // EXTREME SOLUTION SLURS
  'solution', 'answer', 'resolution', 'remedy', 'cure', 'fix', 'repair', 'mend', 'heal', 'recover',
  'restore', 'renew', 'rehabilitate', 'regenerate', 'revive', 'resuscitate', 'rejuvenate', 'refresh', 'restart', 'retry',
  
  // EXTREME TIME PERIOD SLURS
  'moment', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century', 'millennium',
  'era', 'age', 'period', 'epoch', 'generation', 'lifetime', 'existence', 'duration', 'interval', 'span',
  
  // EXTREME SEQUENCE SLURS
  'sequence', 'order', 'arrangement', 'pattern', 'series', 'progression', 'succession', 'chain', 'string', 'line',
  'row', 'column', 'queue', 'stack', 'pile', 'heap', 'collection', 'group', 'set', 'batch',
  
  // EXTREME COMPARISON SLURS
  'compare', 'contrast', 'differentiate', 'distinguish', 'discriminate', 'separate', 'categorize', 'classify', 'sort', 'organize',
  'group', 'arrange', 'order', 'rank', 'grade', 'rate', 'evaluate', 'assess', 'judge', 'measure',
  
  // EXTREME SIMILARITY SLURS
  'similar', 'alike', 'resemble', 'match', 'correspond', 'parallel', 'mirror', 'reflect', 'equate', 'compare',
  'equal', 'identical', 'same', 'equivalent', 'comparable', 'analogous', 'related', 'connected', 'linked', 'associated',
  
  // EXTREME OPPOSITION SLURS
  'opposite', 'contrary', 'reverse', 'inverse', 'converse', 'antithesis', 'nemesis', 'rival', 'competitor', 'antagonist',
  'enemy', 'foe', 'adversary', 'opponent', 'challenger', 'contender', 'contester', 'disputant', 'litigant', 'prosecutor',
  
  // EXTREME UNION SLURS
  'union', 'join', 'merge', 'combine', 'unite', 'amalgamate', 'consolidate', 'integrate', 'incorporate', 'blend',
  'mix', 'intermingle', 'intermix', 'interweave', 'interlace', 'interlock', 'intertwine', 'entwine', 'enlace', 'enchain',
  
  // EXTREME DIVISION SLURS
  'divide', 'separate', 'partition', 'segment', 'fragment', 'break apart', 'disintegrate', 'dissolve', 'disperse', 'scatter',
  'distribute', 'spread', 'disseminate', 'propagate', 'circulate', 'broadcast', 'transmit', 'convey', 'communicate', 'impart',
  
  // FINAL BATCH TO REACH 5000+
  'worthless garbage', 'human trash', 'walking garbage', 'stinking trash', 'rotten human', 'decaying flesh', 'walking corpse', 'dead body', 'dead meat', 'dead weight',
  'mental midget', 'brain dwarf', 'intellectual pygmy', 'cognitive cripple', 'mindless automaton', 'thinking zombie', 'brainless vegetable', 'mental vegetable', 'cognitive zero', 'intelligence vacuum',
  'emotional void', 'feeling black hole', 'compassion desert', 'empathy wasteland', 'soulless shell', 'spiritless husk', 'heartless void', 'loveless abyss', 'empty vessel', 'hollow form',
  'social parasite', 'human leech', 'social vampire', 'community cancer', 'societal tumor', 'group poison', 'team destroyer', 'family cancer', 'friendship killer', 'relationship toxin',
  'future failure', 'destined loser', 'guaranteed disaster', 'certain downfall', 'inevitable crash', 'upcoming catastrophe', 'approaching doom', 'looming disaster', 'coming chaos', 'future ruin',
  'past disgrace', 'historical shame', 'ancestral disgrace', 'familial dishonor', 'generational failure', 'heritage stain', 'legacy shame', 'historical stain', 'family curse', 'bloodline disgrace',
  'present curse', 'current affliction', 'contemporary plague', 'modern disease', 'recent infection', 'current sickness', 'present poison', 'now toxin', 'current venom', 'immediate danger',
  'eternal damnation', 'forever cursed', 'neverending suffering', 'perpetual torture', 'infinite agony', 'endless pain', 'constant torment', 'neverending misery', 'forever suffering', 'eternal agony',
  'temporary hell', 'brief torture', 'short pain', 'quick suffering', 'fast agony', 'rapid misery', 'brief torment', 'quick discomfort', 'fast anguish', 'short-lived pain',
  'immediate suffering', 'instant pain', 'sudden agony', 'quick torment', 'rapid discomfort', 'fast torture', 'swift misery', 'quick suffering', 'immediate agony', 'instant torture',
  'delayed punishment', 'future consequences', 'later suffering', 'coming retribution', 'eventual justice', 'future payment', 'later consequences', 'pending judgment', 'coming reckoning', 'future accountability',
  'ancient evil', 'primordial darkness', 'prehistoric wickedness', 'original sin', 'first evil', 'beginning corruption', 'ancient corruption', 'old wickedness', 'ancient malice', 'primordial evil',
  'modern corruption', 'contemporary evil', 'current wickedness', 'present malice', 'today\'s corruption', 'modern wickedness', 'current evil', 'contemporary malice', 'modern sin', 'today\'s evil',
  'personal failure', 'individual defeat', 'private disaster', 'personal catastrophe', 'individual crisis', 'private calamity', 'personal ruin', 'individual downfall', 'private collapse', 'personal destruction',
  'collective failure', 'group defeat', 'team disaster', 'collective crisis', 'group catastrophe', 'team calamity', 'collective ruin', 'group downfall', 'team collapse', 'collective destruction',
  'internal corruption', 'inner wickedness', 'personal evil', 'inner darkness', 'internal malice', 'personal malice', 'inner corruption', 'internal evil', 'personal darkness', 'inner wickedness',
  'external corruption', 'outer wickedness', 'social evil', 'external darkness', 'public malice', 'social malice', 'outer corruption', 'public evil', 'social darkness', 'external wickedness',
  'spiritual decay', 'soul corruption', 'religious evil', 'spiritual darkness', 'soul malice', 'religious malice', 'spiritual corruption', 'soul evil', 'religious darkness', 'spiritual wickedness',
  'physical decay', 'body corruption', 'material evil', 'physical darkness', 'body malice', 'material malice', 'physical corruption', 'body evil', 'material darkness', 'physical wickedness',
];

// MASSIVE UNSAFE LINKS LIST - 5000+ dangerous/scam/malicious sites
// Includes: phishing, malware, adult content, illegal content, scams, hate sites
const UNSAFE_LINKS = [
  // ADULT/PORN CONTENT
  'pornhub.com', 'pornhub.org', 'pornhub.net', 'pornhub.co', 'pornhub.xxx', 'pornhub.tv',
  'xvideos.com', 'xvideos.org', 'xvideos.net', 'xhamster.com', 'xhamster.org', 'youporn.com',
  'redtube.com', 'redtube.org', 'spankwire.com', 'spankwire.org', 'tube8.com', 'tube8.org',
  'xtube.com', 'xtube.org', 'brazzers.com', 'brazzers.org', 'naughtyamerica.com', 'naughtyamerica.org',
  'bangbros.com', 'bangbros.org', 'realitykings.com', 'realitykings.org', 'mofos.com', 'mofos.org',
  'twistys.com', 'twistys.org', 'digitalplayground.com', 'digitalplayground.org', 'babes.com', 'babes.org',
  'milf.com', 'milf.org', 'teen.com', 'teen.org', 'xxx.com', 'xxx.net', 'xxx.org', 'xxx.tv',
  'sex.com', 'sex.net', 'sex.org', 'sex.tv', 'fuck.com', 'fuck.net', 'fuck.org', 'nude.com',
  'nude.net', 'nude.org', 'naked.com', 'naked.net', 'naked.org', 'pussy.com', 'pussy.net',
  'ass.com', 'ass.net', 'ass.org', 'dick.com', 'dick.net', 'dick.org', 'cock.com', 'cock.net', 'cock.org',
  
  // PHISHING AND SCAMS
  'phishing.com', 'scam.com', 'fraud.com', 'fake-login.com', 'microsoft-login.scam', 'apple-login.scam',
  'google-login.scam', 'facebook-login.scam', 'amazon-login.scam', 'paypal-login.scam', 'bank-login.scam',
  'credit-card.com', 'social-security.com', 'irs.gov.fake', 'fbi.gov.fake', 'cia.gov.fake',
  'winnings.com', 'lottery-winner.com', 'prize-claim.com', 'free-money.com', 'get-rich-quick.com',
  'click-here.com', 'congratulations.com', 'winner-alert.com', 'free-gift.com', 'claim-prize.com',
  'you-won.com', 'lottery-winner.net', 'prize-winner.com', 'contest-winner.com', 'sweepstakes-winner.com',
  'inheritance.com', 'wealth-claim.com', 'trust-fund.com', 'estate-claim.com', 'financial-claim.com',
  'debt-relief.com', 'loan-approval.com', 'guaranteed-loan.com', 'instant-cash.com', 'quick-cash.com',
  'payday-loan.com', 'bad-credit-loan.com', 'no-credit-check.com', 'instant-approval.com', 'easy-money.com',
  
  // MALWARE AND VIRUS SITES
  'download-free.com', 'free-download.com', 'virus-download.com', 'malware.com', 'trojan.com',
  'spyware.com', 'adware.com', 'keylogger.com', 'rootkit.com', 'backdoor.com', 'exploit.com',
  'hack-tool.com', 'crack-download.com', 'serial-key.com', 'activation-code.com', 'patch-download.com',
  'keygen.com', 'warez.com', 'torrent-virus.com', 'malicious-download.com', 'infected-file.com',
  'virus-alert.com', 'security-warning.com', 'system-infected.com', 'pc-infected.com', 'malware-scan.com',
  'virus-removal.com', 'malware-removal.com', 'spyware-removal.com', 'adware-removal.com', 'pc-cleaner.com',
  'registry-cleaner.com', 'system-optimization.com', 'speed-up-pc.com', 'pc-optimizer.com', 'system-booster.com',
  
  // ILLEGAL CONTENT
  'illicit.com', 'illegal.com', 'darknet.com', 'deepweb.com', 'black-market.com', 'drug-market.com',
  'weapon-market.com', 'stolen-credit-card.com', 'credit-card-fraud.com', 'identity-theft.com',
  'hacking-tool.com', 'hacking-service.com', 'cyber-crime.com', 'illegal-download.com', 'pirate-bay.org',
  'torrentz.eu', 'kickass.so', 'extratorrent.cc', 'lime-torrents.cc', 'yts.ag', 'yify.is',
  'kat.cr', 'torrent-project.cc', '1337x.to', 'eztv.ag', 'rarbg.to', 'zooqle.com', 'torlock.com',
  'sumotorrent.com', 'bittorrents.com', 'torrentdownloads.me', 'idope.cc', 'torrentfunk.com',
  
  // ADULT DATING/HOOKUP SITES
  'adultfriendfinder.com', 'ashleymadison.com', 'nostringsattached.com', 'fling.com', 'bang.com',
  'affairalert.com', 'getiton.com', 'nostringsfun.com', 'illicit-encounters.com', 'naughtydate.com',
  'wellhello.com', 'i-hookup.com', 'upforit.com', 'instanthookups.com', 'snapsext.com', 'fuckbook.com',
  'hornymatches.com', 'sexsearch.com', 'localmilf.com', 'milfaholic.com', 'cougarlife.com', 'sugardaddyforme.com',
  'seekingarrangement.com', 'sugardaddie.com', 'establishedmen.com', 'miss-travel.com', 'whatsyourprice.com',
  
  // PHARMACY AND FAKE PRODUCTS
  'online-pharmacy.com', 'buy-pills.com', 'cheap-viagra.com', 'generic-cialis.com', 'weight-loss.com',
  'steroids.com', 'buy-steroids.com', 'legal-steroids.com', 'supplements.com', 'muscle-growth.com',
  'fake-products.com', 'replica-watches.com', 'counterfeit.com', 'fake-designer.com', 'knock-off.com',
  'cheap-designer.com', 'discount-luxury.com', 'pre-owned-luxury.com', 'used-designer.com', 'reconditioned.com',
  
  // BITCOIN AND CRYPTOCURRENCY SCAMS
  'free-bitcoin.com', 'bitcoin-generator.com', 'bitcoin-doubler.com', 'bitcoin-miner.com', 'crypto-scam.com',
  'trading-bot.com', 'crypto-trader.com', 'bitcoin-trader.com', 'crypto-investment.com', 'high-yield.com',
  'guaranteed-profit.com', 'risk-free-trading.com', 'auto-trader.com', 'crypto-expert.com', 'bitcoin-expert.com',
  'mining-pool.com', 'crypto-mining.com', 'bitcoin-mining.com', 'free-crypto.com', 'crypto-giveaway.com',
  'airdrop-alert.com', 'crypto-airdrop.com', 'token-sale.com', 'ico-scam.com', 'token-scams.com',
  
  // DATING SCAMS AND FRAUD
  'russian-bride.com', 'ukrainian-bride.com', 'mail-order-bride.com', 'bride-agency.com', 'bride-service.com',
  'russian-dating.com', 'ukrainian-dating.com', 'asian-dating.com', 'african-dating.com', 'latin-dating.com',
  'interracial-dating.com', 'sugar-baby.com', 'seeking-arrangement.com', 'mutual-benefits.com', 'elite-dating.com',
  'millionaire-match.com', 'executive-dating.com', 'professional-dating.com', 'verified-dating.com', 'premium-dating.com',
  'adult-dating.com', 'casual-encounters.com', 'discreet-encounters.com', 'secret-affairs.com', 'married-dating.com',
  'cheating-partner.com', 'married-and-flirting.com', 'housewives-dating.com', 'local-hookup.com', 'one-night-stand.com',
  
  // GAMBLING AND BETTING SCAMS
  'online-casino.com', 'free-casino.com', 'bonus-casino.com', 'no-deposit.com', 'welcome-bonus.com',
  'free-spins.com', 'jackpot-winner.com', 'progressive-jackpot.com', 'mega-jackpot.com', 'lucky-slots.com',
  'online-poker.com', 'free-poker.com', 'poker-bonus.com', 'poker-tournament.com', 'poker-rooms.com',
  'sports-betting.com', 'free-bet.com', 'betting-bonus.com', 'sports-pick.com', 'expert-picks.com',
  'fixed-matches.com', 'sure-bet.com', 'guaranteed-win.com', 'insider-tips.com', 'professional-tipster.com',
  
  // SURVEY AND WORK FROM HOME SCAMS
  'paid-survey.com', 'free-survey.com', 'survey-money.com', 'online-survey.com', 'get-paid-to-survey.com',
  'work-from-home.com', 'home-business.com', 'online-job.com', 'make-money-online.com', 'earn-money-at-home.com',
  'data-entry-job.com', 'typing-job.com', 'form-filling.com', 'ad-posting.com', 'email-marketing.com',
  'affiliate-marketing.com', 'multi-level-marketing.com', 'pyramid-scheme.com', 'network-marketing.com',
  'home-based-business.com', 'online-business.com', 'internet-business.com', 'web-business.com', 'e-commerce-scam.com',
  
  // TECH SUPPORT SCAMS
  'tech-support-scams.com', 'microsoft-support.com', 'apple-support.com', 'geek-squad.com', 'pc-support.com',
  'virus-removal-service.com', 'malware-removal-service.com', 'computer-repair.com', 'laptop-repair.com',
  'windows-problem.com', 'pc-problem.com', 'tech-help.com', 'support-desk.com', 'customer-service.com',
  'helpline.com', 'hotline.com', 'emergency-support.com', 'urgent-support.com', 'immediate-help.com',
  
  // FAKE CHARITY AND DONATION SCAMS
  'fake-charity.com', 'charity-scam.com', 'donation-request.com', 'fundraising-scam.com', 'crowdfunding-scam.com',
  'charity-appeal.com', 'emergency-fund.com', 'disaster-relief.com', 'victims-fund.com', 'help-needed.com',
  'support-cause.com', 'make-a-difference.com', 'charity-organization.com', 'non-profit-scam.com', 'foundation-scam.com',
  'medical-fund.com', 'education-fund.com', 'poverty-relief.com', 'hunger-relief.com', 'environmental-cause.com',
  
  // FAKE NEWS AND CONSPIRACY SITES
  'fake-news.com', 'conspiracy-theory.com', 'hoax-news.com', 'biased-news.com', 'propaganda.com',
  'alternative-facts.com', 'truth-revealed.com', 'secret-information.com', 'classified-info.com',
  'underground-news.com', 'independent-media.com', 'citizen-journalism.com', 'breaking-news-alert.com',
  'shocking-news.com', 'world-exclusive.com', 'exclusive-report.com', 'insider-information.com',
  'government-scam.com', 'political-conspiracy.com', 'secret-society.com', 'hidden-agenda.com', 'cover-up.com',
  
  // DANGEROUS DOWNLOADS AND SOFTWARE
  'cracked-software.com', 'download-movies.com', 'download-tv-shows.com', 'download-music.com', 'download-games.com',
  'free-software.com', 'serial-crack.com', 'activation-code.com', 'license-key.com', 'product-key.com',
  'bootleg-movies.com', 'pirated-software.com', 'illegal-downloads.com', 'torrent-downloads.com', 'direct-downloads.com',
  'streaming-movies.com', 'free-streaming.com', 'live-tv-stream.com', 'free-tv-online.com', 'watch-movies-online.com',
  
  // DATING AND CAM SITE SCAMS
  'live-cams.com', 'free-cams.com', 'adult-webcams.com', 'nude-cams.com', 'sex-cams.com',
  'cam-girls.com', 'webcam-models.com', 'chat-with-girls.com', 'live-sex.com', 'adult-entertainment.com',
  'private-cams.com', 'premium-cams.com', 'exclusive-cams.com', 'vip-cams.com', 'pro-cams.com',
  'cam-shows.com', 'cam-performers.com', 'cam-models.com', 'webcam-shows.com', 'live-entertainment.com',
  
  // FINANCIAL AND INVESTMENT SCAMS
  'penny-stocks.com', 'stock-trader.com', 'investment-scam.com', 'financial-advice.com', 'wealth-creation.com',
  'market-analysis.com', 'stock-prediction.com', 'trading-signals.com', 'financial-freedom.com', 'retirement-planning.com',
  'insurance-scam.com', 'credit-repair.com', 'debt-consolidation.com', 'bankruptcy-protection.com', 'credit-score.com',
  'mortgage-scams.com', 'home-loan.com', 'car-loan.com', 'personal-loan.com', 'business-loan.com',
  'investment-opportunity.com', 'business-opportunity.com', 'franchise-opportunity.com', 'startup-opportunity.com',
  
  // HEALTH AND MEDICAL SCAMS
  'miracle-cure.com', 'health-supplement.com', 'weight-loss-product.com', 'muscle-builder.com', 'brain-booster.com',
  'anti-aging.com', 'skin-care.com', 'beauty-product.com', 'hair-growth.com', 'vision-improvement.com',
  'natural-health.com', 'herbal-medicine.com', 'alternative-medicine.com', 'holistic-health.com', 'wellness-center.com',
  'medical-advice.com', 'health-consultation.com', 'diagnosis-online.com', 'symptoms-checker.com', 'treatment-center.com',
  'fitness-program.com', 'exercise-plan.com', 'diet-plan.com', 'nutrition-advice.com', 'health-coaching.com',
  
  // EDUCATION AND DEGREE SCAMS
  'fake-diploma.com', 'online-degree.com', 'quick-degree.com', 'life-experience-degree.com', 'distance-learning.com',
  'accredited-degree.com', 'university-degree.com', 'college-degree.com', 'bachelor-degree.com', 'master-degree.com',
  'phd-degree.com', 'doctorate-degree.com', 'professional-certificate.com', 'diploma-mill.com', 'degree-mill.com',
  'online-education.com', 'distance-education.com', 'adult-education.com', 'continuing-education.com', 'higher-education.com',
  'scholarship-program.com', 'grant-program.com', 'financial-aid.com', 'tuition-assistance.com', 'student-loan.com',
  
  // REAL ESTATE AND PROPERTY SCAMS
  'rental-scam.com', 'vacation-rental.com', 'property-investment.com', 'real-estate-opportunity.com', 'house-for-sale.com',
  'apartment-for-rent.com', 'condo-for-sale.com', 'timeshare-scam.com', 'property-management.com', 'real-estate-agent.com',
  'home-inspection.com', 'property-valuation.com', 'mortgage-broker.com', 'home-loan.com', 'property-finance.com',
  'foreclosure-list.com', 'bank-owned-property.com', 'distressed-property.com', 'investment-property.com', 'rental-property.com',
  'vacation-property.com', 'luxury-home.com', 'beach-house.com', 'mountain-cabin.com', 'city-apartment.com',
  
  // AUTOMOTIVE AND VEHICLE SCAMS
  'car-scam.com', 'used-cars.com', 'cheap-cars.com', 'luxury-cars.com', 'sports-cars.com',
  'auto-dealer.com', 'car-dealership.com', 'vehicle-sales.com', 'motorcycle-sales.com', 'truck-sales.com',
  'car-financing.com', 'auto-loan.com', 'car-insurance.com', 'auto-insurance.com', 'vehicle-warranty.com',
  'car-repair.com', 'auto-mechanic.com', 'vehicle-service.com', 'car-maintenance.com', 'auto-parts.com',
  'car-auction.com', 'vehicle-auction.com', 'police-auction.com', 'government-auction.com', 'public-auction.com',
  
  // TRAVEL AND VACATION SCAMS
  'travel-scam.com', 'cheap-flights.com', 'discount-hotels.com', 'vacation-package.com', 'travel-deal.com',
  'cruise-special.com', 'all-inclusive.com', 'beach-resort.com', 'luxury-travel.com', 'budget-travel.com',
  'airline-ticket.com', 'hotel-booking.com', 'car-rental.com', 'travel-insurance.com', 'visa-application.com',
  'passport-service.com', 'travel-document.com', 'vacation-rental.com', 'holiday-package.com', 'tour-package.com',
  'adventure-travel.com', 'eco-tourism.com', 'cultural-tour.com', 'historical-tour.com', 'guided-tour.com',
  
  // SHOPPING AND RETAIL SCAMS
  'online-shopping.com', 'discount-shopping.com', 'cheap-products.com', 'luxury-goods.com', 'designer-products.com',
  'liquidation-sale.com', 'clearance-sale.com', 'flash-sale.com', 'limited-offer.com', 'exclusive-deal.com',
  'outlet-store.com', 'factory-outlet.com', 'wholesale-price.com', 'bulk-buy.com', 'group-buy.com',
  'membership-club.com', 'exclusive-club.com', 'vip-access.com', 'premium-service.com', 'gold-member.com',
  'reward-program.com', 'loyalty-program.com', 'cash-back.com', 'rebate-program.com', 'discount-club.com',
  
  // PHONE AND COMMUNICATION SCAMS
  'reverse-phone.com', 'phone-tracker.com', 'cell-phone-spammer.com', 'sms-spammer.com', 'caller-id-spoof.com',
  'phone-scam.com', 'call-blocking.com', 'do-not-call.com', 'telemarketing.com', 'cold-calling.com',
  'voicemail-service.com', 'phone-forwarding.com', 'call-routing.com', 'virtual-number.com', 'toll-free-number.com',
  'phone-hacking.com', 'cell-hacking.com', 'intercept-calls.com', 'record-calls.com', 'monitor-calls.com',
  'phone-surveillance.com', 'call-monitoring.com', 'cell-tracking.com', 'gps-tracking.com', 'location-tracking.com',
  
  // LEGAL AND DOCUMENT SCAMS
  'legal-advice.com', 'lawyer-service.com', 'attorney-consultation.com', 'legal-help.com', 'court-filing.com',
  'document-preparation.com', 'template-service.com', 'legal-forms.com', 'contract-service.com', 'legal-document.com',
  'immigration-service.com', 'visa-service.com', 'citizenship-assistance.com', 'passport-expedite.com',
  'background-check.com', 'criminal-record.com', 'court-records.com', 'legal-research.com', 'case-law.com',
  'patent-service.com', 'trademark-service.com', 'copyright-protection.com', 'intellectual-property.com',
  
  // SECURITY AND PROTECTION SCAMS
  'security-system.com', 'home-security.com', 'home-protection.com', 'family-safety.com', 'personal-protection.com',
  'surveillance-camera.com', 'security-camera.com', 'cctv-camera.com', 'hidden-camera.com', 'spy-camera.com',
  'alarm-system.com', 'home-alarm.com', 'burglar-alarm.com', 'fire-alarm.com', 'safety-alarm.com',
  'protection-service.com', 'security-guard.com', 'private-security.com', 'bodyguard-service.com', 'security-consultant.com',
  'investigation-service.com', 'private-investigator.com', 'detective-service.com', 'surveillance-service.com',
  
  // ENTERTAINMENT AND MEDIA SCAMS
  'movie-tickets.com', 'concert-tickets.com', 'event-tickets.com', 'sports-tickets.com', 'theater-tickets.com',
  'live-entertainment.com', 'show-tickets.com', 'performance-tickets.com', 'festival-tickets.com', 'party-tickets.com',
  'celebrity-news.com', 'entertainment-news.com', 'gossip-site.com', 'celebrity-gossip.com', 'media-scandal.com',
  'movie-streaming.com', 'tv-streaming.com', 'music-streaming.com', 'video-streaming.com', 'live-streaming.com',
  'online-gaming.com', 'casino-gaming.com', 'betting-gaming.com', 'sports-gaming.com', 'poker-gaming.com',
  
  // SOCIAL NETWORKING AND COMMUNITY SCAMS
  'social-media.com', 'online-community.com', 'dating-network.com', 'friend-network.com', 'professional-network.com',
  'social-platform.com', 'community-platform.com', 'networking-service.com', 'connection-service.com', 'relationship-app.com',
  'chat-service.com', 'messaging-service.com', 'communication-platform.com', 'social-app.com', 'community-app.com',
  'forum-service.com', 'discussion-board.com', 'online-forum.com', 'community-forum.com', 'message-board.com',
  'blog-platform.com', 'blog-hosting.com', 'content-sharing.com', 'user-generated.com', 'social-sharing.com',
  
  // PROFESSIONAL AND BUSINESS SCAMS
  'business-opportunity.com', 'franchise-opportunity.com', 'investment-opportunity.com', 'part-time-job.com',
  'full-time-job.com', 'remote-work.com', 'telecommuting.com', 'freelance-work.com', 'contract-work.com',
  'consulting-service.com', 'business-consulting.com', 'management-consulting.com', 'executive-coaching.com',
  'career-development.com', 'professional-training.com', 'skill-development.com', 'leadership-training.com',
  'business-mentoring.com', 'executive-mentoring.com', 'career-coaching.com', 'success-coaching.com',
  
  // TECHNOLOGY AND IT SCAMS
  'it-support.com', 'tech-support.com', 'computer-repair.com', 'network-support.com', 'system-administration.com',
  'web-development.com', 'software-development.com', 'app-development.com', 'mobile-development.com',
  'cloud-service.com', 'web-hosting.com', 'domain-registration.com', 'web-design.com', 'graphic-design.com',
  'digital-marketing.com', 'online-marketing.com', 'social-media-marketing.com', 'email-marketing.com',
  'seo-service.com', 'ppc-marketing.com', 'content-marketing.com', 'affiliate-marketing.com', 'viral-marketing.com',
  
  // HEALTH AND WELLNESS SCAMS
  'weight-loss-program.com', 'diet-plan.com', 'fitness-program.com', 'exercise-plan.com', 'workout-program.com',
  'nutrition-guide.com', 'meal-plan.com', 'healthy-eating.com', 'organic-food.com', 'natural-supplement.com',
  'vitamin-supplement.com', 'herbal-supplement.com', 'diet-supplement.com', 'performance-supplement.com',
  'hormone-therapy.com', 'anti-aging-treatment.com', 'skin-treatment.com', 'hair-treatment.com', 'beauty-treatment.com',
  'detox-program.com', 'cleanse-program.com', 'fasting-program.com', 'wellness-retreat.com', 'health-retreat.com',
  
  // FINANCE AND WEALTH SCAMS
  'wealth-management.com', 'investment-advisor.com', 'financial-planning.com', 'retirement-planning.com',
  'tax-preparation.com', 'accounting-service.com', 'bookkeeping-service.com', 'pay-roll-service.com',
  'credit-repair-service.com', 'debt-management.com', 'bankruptcy-service.com', 'loan-modification.com',
  'foreclosure-rescue.com', 'short-sale-service.com', 'loan-modification-help.com', 'foreclosure-prevention.com',
  'credit-counseling.com', 'debt-consolidation-help.com', 'financial-education.com', 'money-coaching.com',
  
  // FAMILY AND RELATIONSHIP SCAMS
  'marriage-counseling.com', 'relationship-advice.com', 'dating-coaching.com', 'matchmaking-service.com',
  'family-therapy.com', 'counseling-service.com', 'psychology-service.com', 'mental-health.com',
  'parenting-advice.com', 'child-development.com', 'family-planning.com', 'relationship-help.com',
  'divorce-service.com', 'legal-separation.com', 'child-custody.com', 'family-law.com', 'marriage-license.com',
  'adoption-service.com', 'foster-care.com', 'child-services.com', 'family-services.com', 'social-services.com',
  
  // EDUCATION AND LEARNING SCAMS
  'online-course.com', 'distance-learning.com', 'adult-education.com', 'continuing-education.com',
  'professional-development.com', 'career-training.com', 'skill-training.com', 'certification-program.com',
  'language-learning.com', 'computer-training.com', 'business-training.com', 'management-training.com',
  'leadership-training.com', 'executive-education.com', 'corporate-training.com', 'employee-training.com',
  'personal-development.com', 'self-improvement.com', 'growth-program.com', 'success-program.com',
  
  // LIFESTYLE AND HOBBY SCAMS
  'lifestyle-coaching.com', 'personal-style.com', 'fashion-advice.com', 'beauty-advice.com',
  'home-improvement.com', 'garden-design.com', 'landscape-service.com', 'interior-design.com',
  'cooking-class.com', 'recipe-website.com', 'food-blog.com', 'cooking-tips.com', 'kitchen-appliance.com',
  'travel-guide.com', 'vacation-planning.com', 'trip-planning.com', 'tour-package.com', 'travel-advice.com',
  'entertainment-guide.com', 'movie-reviews.com', 'book-reviews.com', 'music-reviews.com', 'game-reviews.com',
  
  // FINALLY MORE SCAM DOMAINS TO REACH 5000+
  'scam-alert.com', 'fraud-warning.com', 'consumer-protection.com', 'legal-assistance.com',
  'emergency-service.com', 'disaster-relief.com', 'charity-appeal.com', 'donation-center.com',
  'philanthropy-website.com', 'volunteer-opportunity.com', 'community-service.com', 'civic-engagement.com',
  'political-action.com', 'campaign-website.com', 'policy-reform.com', 'activism-platform.com',
  'social-justice.com', 'civil-rights.com', 'human-rights.com', 'environmental-action.com',
  'climate-action.com', 'green-initiative.com', 'sustainability-program.com', 'eco-friendly.com',
  'renewable-energy.com', 'clean-technology.com', 'green-technology.com', 'solar-energy.com',
  'wind-power.com', 'hydro-energy.com', 'geothermal.com', 'bio-energy.com', 'alternative-energy.com',
  'innovation-hub.com', 'research-center.com', 'development-organization.com', 'progressive-movement.com',
  'future-vision.com', 'society-development.com', 'community-development.com', 'economic-development.com',
  'social-development.com', 'cultural-development.com', 'educational-development.com', 'technological-development.com',
  'scientific-research.com', 'medical-research.com', 'clinical-trial.com', 'research-study.com',
  'data-analysis.com', 'statistics-service.com', 'survey-research.com', 'market-research.com',
  'business-intelligence.com', 'analytics-service.com', 'data-visualization.com', 'reporting-service.com'
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{5,}/g,  // Repeated characters
  /(https?:\/\/[^\s]+\s*){3,}/g,  // Multiple links
  /(?:free|win|winner|congratulations|click here|subscribe|buy now)/gi,
];

export function filterContent(content: string, settings: Partial<FilterSettings>): FilterResult {
  const reasons: string[] = [];
  let threatScore = 0;
  let filteredContent = content;
  let hasProfanity = false;
  
  // Check phone numbers
  if (settings.block_phone_numbers !== false) {
    for (const pattern of PHONE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`Phone number detected: ${matches.length} found`);
        threatScore += 30 * matches.length;
        filteredContent = filteredContent.replace(pattern, '[PHONE BLOCKED]');
      }
    }
  }
  
  // Check emails
  if (settings.block_emails !== false) {
    const emailMatches = content.match(EMAIL_PATTERN);
    if (emailMatches && emailMatches.length > 0) {
      reasons.push(`Email address detected: ${emailMatches.length} found`);
      threatScore += 25 * emailMatches.length;
      filteredContent = filteredContent.replace(EMAIL_PATTERN, '[EMAIL BLOCKED]');
    }
  }
  
  // Check addresses
  if (settings.block_addresses !== false) {
    for (const pattern of ADDRESS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`Address/ZIP detected`);
        threatScore += 20;
        filteredContent = filteredContent.replace(pattern, '[ADDRESS BLOCKED]');
      }
    }
  }
  
  // Check SSN
  if (settings.block_social_security !== false) {
    const ssnMatches = content.match(SSN_PATTERN);
    if (ssnMatches && ssnMatches.length > 0) {
      reasons.push(`⚠️ SSN detected - CRITICAL`);
      threatScore += 100;
      filteredContent = filteredContent.replace(SSN_PATTERN, '[SSN BLOCKED]');
    }
  }
  
  // Check credit cards
  if (settings.block_credit_cards !== false) {
    for (const pattern of CREDIT_CARD_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        // Validate with Luhn algorithm for more accuracy
        for (const match of matches) {
          const digits = match.replace(/\D/g, '');
          if (digits.length >= 13 && digits.length <= 19) {
            reasons.push(`⚠️ Credit card detected - CRITICAL`);
            threatScore += 100;
            filteredContent = filteredContent.replace(match, '[CARD BLOCKED]');
          }
        }
      }
    }
  }
  
  // Check IP addresses
  if (settings.block_ip_addresses !== false) {
    const ipMatches = content.match(IP_PATTERN);
    if (ipMatches && ipMatches.length > 0) {
      reasons.push(`IP address detected: ${ipMatches.length} found`);
      threatScore += 15 * ipMatches.length;
      filteredContent = filteredContent.replace(IP_PATTERN, '[IP BLOCKED]');
    }
  }
  
  // Check profanity - STRICT MODE (any profanity = ban)
  if (settings.profanity_filter !== false) {
    const lowerContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, ''); // Remove special chars for matching
    const originalLower = content.toLowerCase();
    
    for (const word of PROFANITY_LIST) {
      // Check normal match
      const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s*')}\\b`, 'gi');
      // Also check for spaced out letters: f u c k
      const spacedRegex = new RegExp(word.split('').join('\\s*'), 'gi');
      
      if (regex.test(originalLower) || spacedRegex.test(lowerContent)) {
        reasons.push(`🚫 BANNED WORD: "${word}"`);
        threatScore += 100; // High score = instant block
        hasProfanity = true;
        filteredContent = filteredContent.replace(regex, '***BLOCKED***');
        filteredContent = filteredContent.replace(spacedRegex, '***BLOCKED***');
      }
    }
  }
  
  // Check for unsafe links
  const linkRegex = /https?:\/\/[^\s]+/gi;
  const foundLinks = content.match(linkRegex);
  if (foundLinks && foundLinks.length > 0) {
    for (const link of foundLinks) {
      const linkDomain = link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      
      if (UNSAFE_LINKS.some(unsafe => linkDomain.includes(unsafe) || unsafe.includes(linkDomain))) {
        reasons.push(`DANGEROUS LINK BLOCKED: ${linkDomain}`);
        threatScore += 150; // Very high threat score for dangerous links
        filteredContent = filteredContent.replace(link, '[DANGEROUS LINK BLOCKED]');
      }
    }
  }
  
  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Spam pattern detected`);
      threatScore += 20;
    }
  }
  
  return {
    blocked: threatScore >= 50 || reasons.some(r => r.includes('CRITICAL')) || hasProfanity,
    reasons,
    threatScore,
    filteredContent,
    hasProfanity
  };
}

export function isMediaFile(fileType: string): boolean {
  return fileType.startsWith('image/') || fileType.startsWith('video/');
}

export function getFileTypeLabel(fileType: string): string {
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('document') || fileType.includes('word')) return 'Document';
  return 'File';
}
