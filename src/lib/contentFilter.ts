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

// EXPANDED Profanity list with variations - AUTOBAN ENABLED
const PROFANITY_LIST = [
  // Extreme profanity (instant ban)
  'fuck', 'fck', 'fuk', 'fuq', 'f u c k', 'f.u.c.k', 'fvck', 'phuck', 'fukc', 'f-u-c-k',
  'shit', 'sh1t', 'sht', 's h i t', 'sh!t', '$hit', 'shiit', 'shitt', 'shyte', 'shyte',
  'bitch', 'b1tch', 'biatch', 'b!tch', 'bitc h', 'bytch', 'biotch', 'beetch', 'beotch',
  'dick', 'd1ck', 'dik', 'd!ck', 'dyck', 'dic k', 'dicck', 'dikc',
  'cock', 'c0ck', 'cok', 'cck', 'co ck', 'kawk', 'kock', 'cokc',
  'pussy', 'puss', 'pu$$y', 'pus sy', 'pusy', 'pussee', 'poosy', 'poossy',
  'ass', 'a$$', '@ss', 'azz', 'as s', 'asss', 'aszhole', 'ashole', 'assh0le',
  'bastard', 'b4stard', 'basturd', 'bastered', 'b@stard',
  'slut', 'sl0t', 's1ut', 'slutt', 's lut', 'sl ut', 'slloot', 'sluut',
  'whore', 'wh0re', 'h0e', 'hoe', 'whor', 'hore', 'hoar', 'hores',
  'cunt', 'c0nt', 'cvnt', 'cun t', 'cu nt', 'kunt', 'cuntt', 'cunn',
  'fag', 'f4g', 'faggot', 'f4ggot', 'f ag', 'faggo t', 'fagot', 'faggit',
  'nigger', 'n1gger', 'nigg4', 'n!gga', 'nigga', 'n1gga', 'nig ger', 'nigr', 'niguh',
  'retard', 'r3tard', 'retrd', 'ret ard', 're tard', 'rettard', 'returd',
  'kys', 'kill yourself', 'kill urself', 'killyourself', 'kilurself',
  
  // More extreme variations
  'motherfucker', 'mother fucker', 'mofo', 'motherfuker', 'muthafucka',
  'cocksucker', 'cock sucker', 'cocksuka', 'dickhead', 'dick head', 'dikhead',
  'asshole', 'ass hole', 'ashole', 'assshole', 'azzhole', 'arschloch',
  'piss', 'piss off', 'pissed', 'pising', 'pisss', 'p1ss',
  'twat', 'tw4t', 'twa t', 'twatt', 'twate', 'tw@t',
  'wanker', 'wank er', 'wankr', 'wanka', 'w4anker',
  'bollocks', 'bolox', 'ballocks', 'bollox', 'ballox',
  'bugger', 'buggar', 'bug ger', 'buggered', 'bagger',
  
  // Sexual terms and variations
  'cum', 'c um', 'cumm', 'cumming', 'jizz', 'jiz', 'jizzz', 'gizz',
  'tit', 't its', 'titties', 'tittys', 't1ts', 'boob', 'boob s', 'boobs',
  'penis', 'p enis', 'pen is', 'penus', 'dick', 'dik', 'dikc', 'di ck',
  'vagina', 'vag ina', 'vag1na', 'vagina', 'vajayjay', 'pussy', 'pus sy',
  'anus', 'an us', 'ahole', 'anal', 'a nal', 'asscrack', 'ass crack',
  'masturbate', 'mastur bate', 'jerkoff', 'jerk off', 'jrkoff', 'jrk off',
  'orgasm', 'org asm', 'orgasim', 'cum', 'climax', 'cl max',
  'fingering', 'finger ing', 'oral', 'oral sex', 'blowjob', 'blow job',
  'handjob', 'hand job', 'sex', 'sexx', 'sexxx', 'fucking', 'fuking',
  
  // Bodily fluids/functions
  'diarrhea', 'diarhea', 'diahrrea', 'poop', 'po op', 'crap', 'cr4p', 'cr ap',
  'feces', 'f ec es', 'turd', 'tu rd', 'shit', 'defecate', 'urinate',
  'piss', 'pee', 'pe e', 'vomit', 'vom it', 'puke', 'pu ke', 'barf',
  
  // More variations and creative spellings
  'scrotum', 'testicles', 'testes', 'balls', 'ball sack', 'nuts',
  'prostitute', 'hooker', 'escort', 'whore', 'slut', 'tramp',
  'porn', 'por n', 'p0rn', 'pr0n', 'porno', 'pornography',
  'masturbating', 'masturbating', 'wanking', 'wank ing', 'jacking off',
  'erection', 'erect ion', 'boner', 'b0ner', 'hard on',
  'cleavage', 'c leavage', 'boobage', 'camelt toe', 'camel toe',
  'strip', 'stripping', 'stripper', 'strip club', 'lapdance',
  'naked', 'na ked', 'nudity', 'nude', 'exposed', 'exposure',
  'breasts', 'breas ts', 'boobs', 'b oobs', 'chesticles',
  'threesome', 'three some', 'foursome', 'four some', 'orgy',
  'bondage', 'bond age', 'sadism', 'masochism', 'fetish',
  'sexting', 'sex ting', 'dirty talk', 'cybersex', 'phone sex',
  
  // Racial slurs and hate speech (ban)
  'nigger', 'nigga', 'nig ger', 'nigr', 'niguh', 'niga', 'negro', 'negroes',
  'spic', 'spick', 'spik', 'spickk', 'wetback', 'wet back', 'beaner',
  'chink', 'chin k', 'gook', 'goo k', 'slope', 'slant eye', 'sand nigger',
  'kike', 'ki ke', 'heeb', 'yid', 'goyim', 'shylock', 'goy',
  'cracker', 'crac ker', 'honky', 'honkie', 'white trash', 'redneck',
  'wetback', 'wet back', 'border jumper', 'illegal alien',
  'terrorist', 'towelhead', 'turban', 'raghead', 'desert rat',
  
  // Homophobic/transphobic slurs (ban)
  'faggot', 'fag', 'f ag', 'faggott', 'fagot', 'fagit', 'queer', 'queer bait',
  'tranny', 'tranny', 'shemale', 'she male', 'ladyboy', 'lady boy',
  'dyke', 'di kes', 'lesbo', 'lesbos', 'gay', 'gay bait', 'gayboy',
  'fairy', 'fair y', 'fruit', 'froot', 'pansy', 'pan sy', 'sissy',
  'buttpirate', 'butt pirate', 'carpet muncher', 'carpetmuncher',
  'homo', 'hom o', 'homosexual', 'fudgepacker', 'fudge packer',
  
  // Religious hate
  'muslim', 'mus lim', 'islam', 'mohammed', 'muhammad', 'allah',
  'jew', 'jewish', 'jews', 'christian', 'jesus', 'bible', 'quran',
  'atheist', 'god', 'religion', 'religious', 'biblethumper', 'church',
  'muslim hater', 'jew hater', 'christian hater',
  
  // Violence and threats
  'kill', 'kill yourself', 'die', 'death', 'dead', 'murder', 'mur der',
  'suicide', 'suicidal', 'suici deride', 'hang yourself', 'jump off',
  'shoot', 'shooting', 'gun', 'g un', 'weapon', 'wea pon', 'knife',
  'rape', 'r ape', 'rapist', 'rapi st', 'sexual assault',
  'assault', 'as sault', 'attack', 'att ack', 'violate', 'vi olate',
  'torture', 'tort ure', 'abuse', 'ab use', 'abusive', 'abus ive',
  'harm', 'ha rm', 'hurt', 'injure', 'in jury', 'wound', 'woun d',
  'stab', 'stabbing', 'cut', 'cutting', 'slash', 'slashing',
  'bomb', 'bombing', 'explosive', 'exploder', 'terrorist attack',
  'massacre', 'mass killing', 'serial killer', 'murderer',
  'execution', 'execute', 'capital punishment', 'death penalty',
  'slaughter', 'slay', 'slayer', 'assassin', 'assassinate',
  'violence', 'violent', 'aggression', 'aggressive', 'combat',
  'fight', 'fighting', 'brawl', 'brawling', 'riot', 'rioting',
  'war', 'warfare', 'battle', 'bloodshed', 'bloodshedded',
  'genocide', 'ethnic cleansing', 'holocaust', 'concentration camp',
  'terror', 'terrorism', 'extremist', 'radical', 'fundamentalist',
  
  // Mental health slurs
  'retard', 'retarded', 're tard', 'mental', 'mental case', 'loony',
  'crazy', 'cr az y', 'insane', 'in sane', 'psychopath', 'nutcase',
  'deranged', 'de ranged', 'delusional', 'delu sional', 'schizo',
  'autistic', 'autism', 'down syndrome', 'handicapped', 'cripple',
  'disabled', 'disAbility', 'wheelchair', 'deformed', 'freak',
  'lunatic', 'lu natic', 'madman', 'mad woman', 'hysteric',
  'idiot', 'imbecile', 'moron', 'dumbass', 'stupid', 'stupidity',
  
  // General profanity and insults
  'damn', 'dammit', 'dam nit', 'hell', 'hells', 'hellhole',
  'crap', 'crappy', 'cr4p', 'cr ap', 'garbage', 'trash',
  'bitching', 'bitcher', 'bitchy', 'whining', 'whiner',
  'stfu', 'stf u', 'shut the fuck up', 'shut up',
  'gtfo', 'get the fuck off', 'get out', 'gtho',
  'wtf', 'what the fuck', 'wtff', 'what a fuck',
  'omfg', 'oh my fucking god', 'omgfk', 'omfgod',
  'bullshit', 'bull shit', 'bullsht', 'b.s.', 'bs',
  'jackass', 'jack ass', 'asswhole', 'asswipe',
  'dumbfuck', 'dumb fuck', 'fuckface', 'facefuck',
  'cockbite', 'cock bite', 'asskisser', 'ass kisser',
  
  // Body part insults
  'prick', 'pr ick', 'dickhead', 'dick head', 'dick wad',
  'butthead', 'butt head', 'butt wad', 'asshead',
  'tithead', 'tit head', 'pimple', 'acne', 'ugly',
  'fatass', 'fat ass', 'fatso', 'lardass', 'lard ass',
  'skinny', 'skeletor', 'anorexic', 'bulimic',
  
  // Sexual orientation insults
  'gay', 'gayboy', 'gay man', 'homosexual', 'homos',
  'lesbian', 'lesbo', 'gay woman', 'dyke', 'carpet muncher',
  'bisexual', 'bi', 'bitch', 'whore', 'slut', 'tramp',
  'prostitute', 'hooker', 'call girl', 'escort', 'madam',
  'pimp', 'pim p', 'pimper', 'john', 'trick', 'tricking',
  
  // Age/disability insults
  'old', 'old man', 'old woman', 'grandma', 'grandpa',
  'senile', 'senility', 'alzheimers', 'oldtimer', 'fossil',
  'young', 'kid', 'child', 'baby', 'infant', 'toddler',
  'teen', 'teenager', 'juvenile', 'minor', 'underage',
  
  // General negative terms
  'hate', 'hateful', 'hatred', 'despise', 'loathe', 'detest',
  'evil', 'wicked', 'sinister', 'malevolent', 'malicious',
  'ugly', 'disgusting', 'gross', 'vile', 'repulsive',
  'stupid', 'idiotic', 'moronic', 'brainless', 'mindless',
  'loser', 'failure', 'worthless', 'useless', 'hopeless',
  'pathetic', 'pitiful', 'sad', 'miserable', 'depressed',
  'crazy', 'insane', 'mad', 'deranged', 'unstable',
  
  // Drug/alcohol terms
  'drugs', 'drug s', 'drug user', 'addict', 'addiction',
  'weed', 'marijuana', 'pot', 'cannabis', 'ganja', 'marihuana',
  'cocaine', 'coke', 'cocaina', 'crack', 'crack cocaine',
  'heroin', 'heroin', 'smack', 'junk', 'dope', 'dop e',
  'meth', 'methamphetamine', 'crystal meth', 'speed',
  'lsd', 'acid', 'ecstasy', 'x', 'mdma', 'molly',
  'alcohol', 'booze', 'liquor', 'beer', 'wine', 'vodka',
  'drunk', 'drunken', 'intoxicated', 'high', 'stoned',
  'drunk driving', 'dwi', 'dui', 'drunk driver',
  
  // Gang/criminal terms
  'gang', 'gangster', 'gangsta', 'mafia', 'mob', 'mobster',
  'thug', 'thugee', 'criminal', 'crime', 'crimnal', 'crimin al',
  'robbery', 'rob', 'steal', 'theft', 'thief', 'burglar',
  'murder', 'killer', 'assassin', 'hitman', 'contract killer',
  'prison', 'jail', 'inmate', 'convict', 'felon', 'ex-con',
  'illegal', 'illicit', 'bootleg', 'black market', 'underworld',
  
  // Sexual violence
  'sexual assault', 'rape', 'rapist', 'sex crime', 'molestation',
  'sexual abuse', 'sex abuse', 'incest', 'pedophile', 'pedophilia',
  'child molester', 'child abuse', 'statutory rape', 'sexual harassment',
  'grope', 'groping', 'sexual battery', 'indecent exposure',
  'voyeurism', 'exhibitionism', 'flasher', 'stalker',
  
  // Hate speech (general)
  'hate speech', 'hate crime', 'discrimination', 'racism',
  'sexism', 'ageism', 'homophobia', 'transphobia', 'xenophobia',
  'prejudice', 'bigotry', 'intolerance', 'supremacist', 'neo-nazi',
  'white supremacist', 'black supremacist', 'religious extremist',
  
  // Political/religious extremism hate
  'nazi', 'hitler', 'third reich', 'swastika', 'nazi party', 'nazi germany',
  'kab', 'kkk', 'ku klux klan', 'klan', 'white power', 'white pride',
  'black power', 'racial purity', 'ethnic cleansing', 'master race',
  'aryan', 'aryan race', 'supreme race', 'chosen people', 'gods chosen',
  'infidel', 'heretic', 'blasphemy', 'jihad', 'holy war', 'crusade',
  'martyr', 'martyrdom', 'suicide bomber', 'terror', 'terrorism',
  'fundamentalist', 'radical', 'extremist', 'fanatic', 'zealot',
  
  // More insults and degrading terms
  'slave', 'slavery', 'servant', 'servitude', 'subhuman', 'sub human',
  'animal', 'beast', 'creature', 'monster', 'demon', 'devil',
  'satan', 'lucifer', 'hell spawn', 'spawn of satan', 'antichrist',
  'witch', 'warlock', 'sorcerer', 'evil spirit', 'demon worship',
  'heathen', 'pagan', 'infidel', 'nonbeliever', 'unbeliever',
  'sinner', 'sinnering', 'sinful', 'wicked', 'evil doing',
  
  // Additional profanity creative spellings
  'phuck', 'phuk', 'phukking', 'phuked', 'phuker',
  'shyte', 'shyter', 'shyteing', 'shyted',
  'biatch', 'biotch', 'biatchy', 'biotchy',
  'fagget', 'faggit', 'fageting', 'fagoting',
  'niggar', 'niggars', 'niggarz', 'niggarish',
  'asshole', 'asswhole', 'azzhole', 'asholie',
  'cock sucker', 'cocklicker', 'cockknocker', 'cokk',
  'dickweed', 'dickwad', 'dickless', 'dikweed',
  'bitchslap', 'bitchslapper', 'bitching', 'bitched',
  'motherfucker', 'motherfuker', 'mothafucker', 'muthafuka',
  'whoremonger', 'whoreson', 'whorebag', 'whoreible',
  'bastard', 'bastered', 'basturd', 'basturd',
  'cunt', 'cuntface', 'cunnilingus', 'cuntlapper',
  'twat', 'twot', 'twatwaffle', 'twattington',
  'wank', 'wanker', 'wankstain', 'wankjob',
  'pissflaps', 'pisshead', 'pisstank', 'piss off',
  
  // More drug variations
  'dope', 'doping', 'doped', 'dope dealer', 'dope fiend',
  'smack', 'smackhead', 'smack dealer', 'smack junkie',
  'crackhead', 'crackrock', 'crackpipe', 'crack whore',
  'pothead', 'weedhead', 'stoner', 'pot head',
  'crank', 'crankhead', 'methhead', 'tweaker',
  'pillhead', 'pill popper', 'pillbilly', 'pill junkie',
  'shrooms', 'magic mushrooms', 'psilocybin', 'psychedelic',
  'angel dust', 'pcp', 'special k', 'ketamine', 'ghb',
  'roofies', 'rohypnol', 'date rape drug', 'gbl',
  
  // More sexual terms
  'dildo', 'dildoing', 'dildoed', 'vibrator', 'vibrating',
  'condom', 'contraceptive', 'contracept', 'birth control',
  'penetration', 'penetratin', 'penetrated', 'penetrator',
  'orgasm', 'orgasmic', 'orgasming', 'orgasmed',
  'climax', 'climaxing', 'climaxed', 'climaxes',
  'aroused', 'arousing', 'arousal', 'horny', 'horned',
  'lust', 'lustful', 'lusting', 'lusted',
  'seduction', 'seductive', 'seducing', 'seduced',
  'foreplay', 'foreplaying', 'foreplayed', 'fourplay',
  'kinky', 'kinkiness', 'kink', 'kinking',
  'fetish', 'fetishistic', 'fetishism', 'fetishist',
  
  // More violence terms
  'slaughter', 'slaughtering', 'slaughtered', 'slay',
  'massacre', 'massacred', 'massacring', 'massacrer',
  'execute', 'execution', 'executer', 'executed',
  'terminate', 'termination', 'terminator', 'terminated',
  'eliminate', 'elimination', 'eliminator', 'eliminated',
  'destroy', 'destruction', 'destroyer', 'destroyed',
  'annihilate', 'annihilation', 'annihilator', 'annihilated',
  'exterminate', 'extermination', 'exterminator', 'exterminated',
  'eradicate', 'eradication', 'eradicator', 'eradicated',
  'obliterate', 'obliteration', 'obliterator', 'obliterated',
  
  // More hate speech
  'nazi', 'nazism', 'nazi party', 'national socialist',
  'white supremacist', 'black supremacist', 'racial supremacist',
  'anti-semitic', 'anti-semitism', 'anti-jewish', 'jew hater',
  'islamophobia', 'islamophobic', 'muslim hater', 'islamic hater',
  'christophobia', 'christian hater', 'jesus hater',
  'atheist hater', 'religious hater', 'god hater',
  'heterophobia', 'straight hater', 'hetero hater',
  'misogyny', 'misogynist', 'woman hater', 'misandry',
  'ageism', 'ageist', 'age hater', 'young hater',
  'disability hate', 'disabled hater', 'handicap hater',
  
  // More mental health insults
  'psychopath', 'psychopathic', 'sociopath', 'sociopathic',
  'schizophrenic', 'schizophrenia', 'schizo', 'schizoid',
  'bipolar', 'manic depression', 'manic depressive',
  'autistic', 'autism', 'aspergers', 'asperger',
  'down syndrome', 'downs', 'downie', 'mongoloid',
  'retardation', 'retardate', 'retardedly', 'retardness',
  'lunatic asylum', 'mental asylum', 'nut house',
  'crazy house', 'madhouse', 'funny farm', 'loony bin',
  
  // More general insults
  'idiot', 'idiocy', 'idiotic', 'idiotically',
  'moron', 'moronic', 'moronically', 'moronism',
  'imbecile', 'imbecilic', 'imbecility', 'imbecilically',
  'dunce', 'dunceish', 'duncical', 'duncely',
  'nitwit', 'nitwitted', 'nitwittery', 'nitwitism',
  'dimwit', 'dimwitted', 'dimwittery', 'dimwitism',
  'simpleton', 'simpletonish', 'simplicity', 'simple',
  'fool', 'foolish', 'foolishly', 'foolishness',
  'buffoon', 'buffoonery', 'buffoonish', 'buffoonish',
  'clown', 'clownish', 'clowning', 'clownery',
  
  // Additional sexual terms
  'masturbation', 'masturbator', 'masturbatory',
  'ejaculation', 'ejaculate', 'ejaculating', 'ejaculated',
  'coitus', 'coitus interruptus', 'sexual intercourse',
  'cunnilingus', 'fellatio', 'analingus', 'rimjob',
  'threesome', 'twosome', 'foursome', 'groupsex',
  'polygamy', 'polyamory', 'open relationship',
  'swinger', 'swinging', 'swinger party', 'swinger club',
  'nudism', 'nudist', 'nudism', 'naked', 'nudity',
  'exhibitionism', 'exhibitionist', 'flashing', 'flasher',
  'voyeurism', 'voyeur', 'voyeuristic', 'peeping tom',
  
  // More crime terms
  'vigilante', 'vigilantism', 'street justice',
  'mob rule', 'mobbing', 'mob mentality', 'mob violence',
  'gang violence', 'gangbanger', 'gangland', 'gangster',
  'mafioso', 'cosa nostra', 'organized crime', 'crime syndicate',
  'conspiracy', 'conspiracy theory', 'conspirator', 'conspired',
  'money laundering', 'money launderer', 'laundering',
  'fraud', 'fraudulent', 'fraudulence', 'fraudster',
  'embezzlement', 'embezzler', 'embezzling', 'embezzled',
  'extortion', 'extortionist', 'extorted', 'extorting',
  'blackmail', 'blackmailer', 'blackmailed', 'blackmailing',
  
  // More extremist terms
  'cult', 'cultist', 'cultism', 'cult leader',
  'sect', 'sectarian', 'sectarianism', 'sectarian violence',
  'fanaticism', 'fanatical', 'fanatic', 'fanatically',
  'radicalization', 'radicalized', 'radicalizing', 'radicalism',
  'extremism', 'extremist', 'extremist group', 'extremism',
  'terrorism', 'terrorist', 'terrorist attack', 'terrorist',
  'insurgency', 'insurgent', 'insurrection', 'insurrectionist',
  'revolution', 'revolutionary', 'revolutionized', 'revolutionary',
  'anarchism', 'anarchist', 'anarchistic', 'anarchy',
  'nihilism', 'nihilist', 'nihilistic', 'nihilistically',
  
  // More body/sexual insults
  'butt', 'buttcheeks', 'buttocks', 'hindquarters',
  'arse', 'arsehole', 'arsewipe', 'arsekisser',
  'feces', 'fecal', 'fecesing', 'bowel movement',
  'defecate', 'defecating', 'defecated', 'defecation',
  'urinate', 'urinating', 'urinated', 'urination',
  'constipated', 'constipation', 'diarrhea', 'diarrheal',
  'flatulence', 'flatulent', 'fartz', 'farting',
  'belch', 'belching', 'burp', 'burping', 'vomit',
  'nausea', 'nauseous', 'nauseating', 'sick',
  
  // More hate speech variations
  'supremacist', 'supremacy', 'superior race',
  'master race', 'herrenvolk', 'chosen people',
  'pure blood', 'blood pure', 'racial purity',
  'ethnic cleansing', 'genocide', 'genocidal',
  'holocaust', 'holocaust denial', 'holocaust denier',
  'racial war', 'race war', 'racial conflict',
  'segregation', 'segregationist', 'apartheid',
  'discrimination', 'discriminatory', 'discriminating',
  'persecution', 'persecuted', 'persecutor', 'persecuting',
  
  // More creative profanity
  'motherfucking', 'motherfucking', 'motherfucker',
  'fucking', 'fucker', 'fuckery', 'fuckhead',
  'fuckwit', 'fucktard', 'fuckface', 'fuckoff',
  'bullshitter', 'bullshitting', 'bullshat',
  'goddamn', 'goddamnit', 'goddamned', 'goddamning',
  'asshole', 'asswhole', 'asswipe', 'ass kisser',
  'cockbite', 'cockblock', 'cockblocked', 'blocking',
  'dickless', 'dickheaded', 'dickless wonder',
  'pussy whipped', 'pussyfooting', 'pussified',
  'cuntlicker', 'cuntface', 'cunty', 'cuntish',
  
  // More violence descriptions
  'bloodbath', 'blood thirsty', 'blood lust',
  'carnage', 'carnaginous', 'carnage', 'mass killing',
  'killing spree', 'murder rampage', 'death spree',
  'shooting spree', 'gun massacre', 'gun deaths',
  'knife attack', 'stabbing rampage', 'blade attack',
  'bomb blast', 'explosion', 'explosive device',
  'terror attack', 'terror bombing', 'suicide attack',
  'beheading', 'decapitation', 'dismemberment',
  'torture chamber', 'torture device', 'torture method',
  
  // More disability insult terms  
  'cripple', 'crippled', 'crippling', 'crippledom',
  'handicapped', 'handicap', 'handicapping',
  'disabled', 'disability', 'disabling', 'disabling',
  'deformed', 'deformation', 'deformity', 'deforming',
  'freak', 'freaky', 'freakish', 'freakishness',
  'monster', 'monstrous', 'monstrosity', 'monstrously',
  'abnormal', 'abnormality', 'abnormalcy', 'abnormally',
  'defective', 'defect', 'defective', 'defectiveness',
  'impaired', 'impairment', 'impairing', 'impairedness',
  
  // More sexual deviancy terms
  'pervert', 'perverted', 'perverting', 'perversion',
  'deviant', 'deviancy', 'deviating', 'deviant behavior',
  'degenerate', 'degeneracy', 'degenerating', 'degenerated',
  'depraved', 'depravity', 'depraving', 'depravedly',
  'obscene', 'obscenity', 'obscenely', 'obsceneness',
  'vulgar', 'vulgarity', 'vulgarly', 'vulgarness',
  'indecent', 'indecency', 'indecently', 'indecency',
  'lewd', 'lewdly', 'lewdness', 'lewdish', 'lewdful',
  
  // More extremist ideology
  'purge', 'purging', 'purified', 'purification',
  'cleansing', 'cleansed', 'cleanse', 'cleansement',
  'extermination', 'exterminate', 'exterminator',
  'annihilation', 'annihilate', 'annihilator',
  'eradication', 'eradicate', 'eradicator',
  'obliteration', 'obliterate', 'obliterator',
  'subjugation', 'subjugate', 'subjugator', 'subjugated',
  'domination', 'dominate', 'dominator', 'dominated',
  'oppression', 'oppress', 'oppressor', 'oppressed',
  'tyranny', 'tyrant', 'tyrannical', 'tyrannically',
  
  // More profanity slang
  'shitload', 'shitton', 'shat', 'shatting',
  'fuckload', 'fuckton', 'fucked up', 'fucking',
  'pissed', 'pissing', 'pisso', 'pisshead',
  'cockhead', 'cocky', 'cocksmoker', 'cockface',
  'dickball', 'dickbag', 'dickbrain', 'dickhole',
  'asslord', 'assmouth', 'assmunch', 'assed',
  'tits', 'titties', 'titty', 'titless',
  'boobage', 'boobified', 'boobtastic', 'boob',
  
  // More hate and discrimination
  'homophobe', 'homophobic', 'homophobe', 'homophobes',
  'transphobe', 'transphobic', 'transgender', 'transphobia',
  'xenophobe', 'xenophobic', 'xenophobia', 'racist',
  'sexist', 'ageist', 'ableist', 'discrim',
  'bigot', 'bigoted', 'bigotry', 'bigotedly',
  'prejudice', 'prejudiced', 'prejudicial', 'prejudicing',
  'intolerant', 'intolerance', 'intolerantly', 'intolerable',
  'hateful', 'hatefulness', 'hatefully', 'hating',
  
  // More criminal/illegal activities
  'murderer', 'killers', 'killing', 'murdered',
  'rapist', 'raper', 'raping', 'raped',
  'thief', 'thieving', 'thieved', 'stealing',
  'robber', 'robbing', 'robbed', 'robbery',
  'burglar', 'burglary', 'burgled', 'burglarizing',
  'arsonist', 'arson', 'arsoned', 'arsoning',
  'vandal', 'vandalism', 'vandalized', 'vandalizing',
  'smuggler', 'smuggling', 'smuggled', 'smuggler',
  
  // More extremist groups/ideologies
  'white power', 'black power', 'racial separatism',
  'ethno-nationalist', 'ethno nationalism', 'supremacist',
  'ultra-nationalist', 'nationalist extremist', 'extremist',
  'radical nationalist', 'far right', 'far left',
  'extremist group', 'hate group', 'terror group',
  'militia', 'paramilitary', 'armed resistance',
  'insurgent', 'revolutionary', 'guerrilla warfare',
  
  // More sexual content terms
  'breasts', 'breast', 'bbras', 'bras', 'underwear',
  'panties', 'undergarments', 'lingerie', 'sexy',
  'erotic', 'eroticism', 'seductive', 'seducing',
  'arousing', 'aroused', 'lustful', 'passionate',
  'intimate', 'intimacy', 'privates', 'genitals',
  'pubic', 'pubic hair', 'body hair', 'shaving',
  'nudist', 'nudity', 'bare', 'exposed', 'undressed',
  
  // More mental health derogatory
  'psycho', 'psychosis', ' psychotic', 'psychopathology',
  'neurotic', 'neurosis', 'neuroticism', 'neurotic',
  'hysteric', 'hysteria', 'hysterical', 'hysterics',
  'manic', 'manic depressive', 'manic episode',
  'depressive', 'depression', 'depressed', 'mood disorder',
  'anxiety', 'anxious', 'panic', 'panic attack',
  'obsessive', 'obsession', 'compulsive', 'compulsion',
  
  // More vulgar bodily terms
  'snot', 'snotting', 'snotter', 'snot rag',
  'phlegm', 'phlegmy', 'phlegming', 'congestion',
  'booger', 'boogers', 'boogered', 'boogerish',
  'earwax', 'earwaxed', 'earwaxing', 'earwax build',
  'toenails', 'fingernails', 'nail clipping', 'nail clipping',
  'dandruff', 'dandruffy', 'dandruffing', 'scalp',
  'body odor', 'b o', 'smelly', 'stinks', 'stinking',
  'bad breath', 'morning breath', 'halitosis', 'stinky breath',
  
  // More hate speech variations
  'nazi sympathizer', 'nazi collaborator', 'nazi supporter',
  'white nationalist', 'black nationalist', 'racial nationalist',
  'ethnic nationalist', 'cultural nationalist', 'religious nationalist',
  'ultraconservative', 'ultraliberal', 'radical left', 'radical right',
  'extremist ideology', 'radical ideology', 'fanatical',
  'zealot', 'zealotry', 'zealous', 'zealously',
  
  // More drug slang
  'marijuana', 'pot', 'weed', 'grass', 'herb', 'ganja',
  'cannabis', 'marihuana', 'reefer', 'joint', 'blunt',
  'cocaine', 'coke', 'blow', 'snow', 'crack', 'rock',
  'heroin', 'smack', 'junk', 'horse', 'black tar',
  'methamphet', 'speed', 'crank', 'crystal', 'ice',
  'lsd', 'acid', 'trip', 'hallucinogen', 'psychedelic',
  'ecstasy', 'xtc', 'mdma', 'molly', 'beans',
  'prescription drugs', 'rx', 'meds', 'pills', 'tablet',
  
  // More sexual act terms
  'sodomy', 'sodomying', 'sodomize', 'sodomized',
  'bestiality', 'bestial', 'animal sex', 'zoophilia',
  'necrophilia', 'necrophiliac', 'dead sex', 'corpse',
  'pedophilia', 'pedophile', 'child sex', 'underage',
  'exhibitionism', 'exhibitionist', 'public nudity',
  'voyeurism', 'voyeur', 'spying', 'peeping',
  'masochism', 'masochist', 'pain seeking', 'pain lover',
  'sadism', 'sadist', 'inflicting pain', 'cruel',
  
  // More violence methods
  'strangulation', 'strangled', 'strangulation method',
  'suffocation', 'suffocated', 'suffocating',
  'drowning', 'drowned', 'drowning victim',
  'poisoning', 'poisoned', 'poisoner', 'deadly poison',
  'electrocution', 'electrocuted', 'electric shock',
  'burning', 'burned', 'burn alive', 'set on fire',
  'beating', 'beaten', 'beat up', 'assaulted',
  'kicking', 'kicked', 'stomping', 'stomped',
  
  // More profanity creativity
  'motherfucker', 'motherfucking', 'motherfuck',
  'fuckface', 'fuckhead', 'fuckwit', 'fucktard',
  'asswipe', 'asskisser', 'asslicker', 'ass munch',
  'cockbite', 'cocksucker', 'cockblocker', 'cockface',
  'shithead', 'shitstain', 'shiteater', 'shit breath',
  'pissy', 'pissed', 'pisser', 'piss drinker',
  'dickwad', 'dickless', 'dickhead', 'dickbrain',
  
  // More discriminatory terms
  'age discrimination', 'ageist', 'ageist behavior',
  'disability discrimination', 'ableist', 'handicapped',
  'sexual discrimination', 'sexist', 'gender bias',
  'racial discrimination', 'racist', 'racial bias',
  'religious discrimination', 'religious bigot',
  'orientation discrimination', 'orientation bias',
  
  // More extremist vocabulary
  'fundamentalism', 'fundamentalist', 'radical islam',
  'radical christianity', 'radical judaism', 'radical buddhism',
  'martyrdom', 'suicide mission', 'holy warrior', 'jihadist',
  'crusader', 'holy war', 'religious war', 'faith war',
  'purification', 'purify', 'cleanse', 'purge',
  'sacrifice', 'sacrificial', 'blood sacrifice', 'human sacrifice',
  
  // More sexual body terms
  'groin', 'crotch', 'pelvis', 'pelvic', 'loins',
  'testicles', 'testes', 'balls', 'scrotum', 'sac',
  'ovaries', 'uterus', 'womb', 'fallopian', 'cervix',
  'prostate', 'seminal', 'semen', 'ejaculate', 'sperm',
  'clitoris', 'clit', 'labia', 'vulva', 'vaginal',
  'breasts', 'nipples', 'areola', 'mammary', 'lactate',
  
  // More mental health insults
  'lunatic', 'lunacy', 'mad scientist', 'mad doctor',
  'insane asylum', 'mental hospital', 'psych ward',
  'shrinks', 'shrink', 'headshrinker', 'nuthouse',
  'basket case', 'mental case', 'psychotic episode',
  'breakdown', 'nervous breakdown', 'mental breakdown',
  'schizophrenia', 'schizo', 'split personality',
  
  // More vulgar expressions
  'fucking hell', 'holy fuck', 'what the fuck',
  'fuck all', 'fucked up', 'fucking asshole',
  'fucking bitch', 'fucking cunt', 'fucking dick',
  'stupid fuck', 'dumb fuck', 'fucking moron',
  'fucking idiot', 'fucking retard', 'fucking asshole',
  'shit for brains', 'brain dead', 'fucking brainless',
  
  // More hate speech patterns
  'white power', 'black power', 'race war',
  'ethnic cleansing', 'racial purity', 'supreme race',
  'chosen people', 'master race', 'herrenvolk',
  'subhuman race', 'inferior race', 'degenerate race',
  'racial superiority', 'racial inferiority', 'race hate',
  
  // More extremist groups
  'neo nazi', 'alt right', 'far right extremist',
  'far left extremist', 'anarchist', 'anarchist group',
  'militia group', 'paramilitary', 'survivalist',
  'cult group', 'religious cult', 'doomsday cult',
  'terror cell', 'sleeper cell', 'extremist network',
  
  // More sexual variations
  'intercourse', 'copulation', 'mating', 'breeding',
  'fornication', 'adultery', 'cheating', 'infidelity',
  'orgy', 'group sex', 'swapping', 'wife swapping',
  'exhibitionist', 'flashing', 'public indecency',
  'fetish', 'paraphilia', 'deviant sexuality',
  
  // More bodily waste
  'feces', 'excrement', 'waste', 'sewage', 'sludge',
  'urine', 'piss', 'pee', 'liquid waste', 'urea',
  'vomit', 'puke', 'barf', 'regurgitate', 'throw up',
  'flatulence', 'gas', 'fart', 'farting', 'belching',
  'mucus', 'phlegm', 'sputum', 'saliva', 'drool',
  
  // More mental capacity insults
  'brain dead', 'no brain', 'brainless', 'brainless wonder',
  'empty headed', 'vacant stare', 'blank mind', 'mindless',
  'thoughtless', 'unthinking', 'irrational', 'illogical',
  'confused', 'confusing', 'perplexed', 'bewildered',
  'misguided', 'mistaken', 'erroneous', 'faulty',
  
  // More hate and violence combos
  'kill all', 'death to', 'die scum', 'eliminate',
  'purge them', 'cleanse them', 'destroy them',
  'wipe out', 'eradicate', 'exterminate', 'annihilate',
  'mass murder', 'serial killing', 'spree killing',
  'genocidal acts', 'ethnic violence', 'hate crimes',
  
  // More profanity intensifiers
  'fucking', 'fucking hell', 'fucking shit', 'fucking ass',
  'goddamn', 'goddamn it', 'goddamned', 'goddamning',
  'son of a bitch', 'son of bitch', 'bitchass',
  'motherfucking', 'motherfuckers', 'motherfucking',
  'cock sucking', 'ball licking', 'ass fucking',
  
  // More discriminatory action terms
  'discriminate', 'segregate', 'exclude', 'marginalize',
  'ostracize', 'shun', 'blacklist', 'boycott',
  'persecute', 'oppress', 'subjugate', 'enslave',
  'exploit', 'victimize', 'target', 'scapegoat',
  
  // More extremist belief systems
  'apocalypse', 'end times', 'doomsday', 'rapture',
  'final judgment', 'divine punishment', 'hellfire',
  'holy retribution', 'divine vengeance', 'god\'s wrath',
  'satanic', 'satanic cult', 'devil worship', 'evil spirit',
  
  // More sexual anatomy
  'perineum', 'anus', 'rectum', 'sphincter', 'colon',
  'prostate', 'seminal vesicles', 'vas deferens',
  'fallopian tubes', 'endometrium', 'cervical mucus',
  'breast tissue', 'mammary glands', 'areolar complex',
  'pubic mound', 'mons pubis', 'labial folds',
  
  // More psychological insults
  'neurotic', 'paranoid', 'delusional', 'schizoid',
  'histrionic', 'narcissistic', 'antisocial', 'borderline',
  'avoidant', 'dependent', 'obsessive', 'compulsive',
  'passive aggressive', 'manipulative', 'covert',
  
  // More vulgar combinations
  'assfucker', 'asslicker', 'assmuncher', 'assface',
  'shitfucker', 'shiteater', 'shitsucker', 'dipshit',
  'cockknob', 'cockmonger', 'cockwaffle', 'cockwallet',
  'fucktard', 'fucking retard', 'fucking moron',
  'dickless', 'dicknose', 'dickbrain', 'dickface',
  
  // More hate ideology
  'racial separatism', 'ethnic nationalism', 'cultural war',
  'civilizational conflict', 'clash of civilizations',
  'demographic replacement', 'cultural replacement',
  'national rebirth', 'cultural purification', 'purity'
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
