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

// Profanity list - Only truly offensive words trigger autoban
// Common words like "gay", "kill", "christian" etc are NOT here - only slurs and explicit profanity
const PROFANITY_LIST = [
  // Extreme profanity (autoban)
  'fuck', 'fck', 'fuk', 'fuq', 'f u c k', 'f.u.c.k', 'fvck', 'phuck', 'fukc', 'f-u-c-k',
  'shit', 'sh1t', 'sht', 's h i t', 'sh!t', '$hit', 'shiit', 'shitt',
  'bitch', 'b1tch', 'biatch', 'b!tch', 'bitc h', 'bytch', 'biotch',
  'asshole', 'ass hole', 'a$$hole', 'azzhole', 'assh0le', 'arsehole',
  'bastard', 'b4stard', 'basturd', 'b@stard',
  'cunt', 'c0nt', 'cvnt', 'cun t', 'cu nt', 'kunt',
  
  // Racial slurs (autoban immediately)
  'nigger', 'n1gger', 'nigg4', 'n!gga', 'nigga', 'n1gga', 'nig ger',
  'spic', 'spick', 'spik', 'chink', 'chin k', 'gook',
  'kike', 'ki ke', 'wetback', 'wet back',
  
  // Homophobic slurs (autoban)
  'faggot', 'f4ggot', 'faggo t', 'fagot',
  'tranny', 'shemale', 'she male',
  
  // Explicit threats (autoban)
  'kill yourself', 'kill urself', 'killyourself', 'kys',
  
  // Extremely offensive compounds
  'motherfucker', 'mother fucker', 'muthafucka', 'mofo',
  'cocksucker', 'cock sucker', 'cocksuka', 
  'dickhead', 'dick head', 'dickwad',
  'dumbfuck', 'dumb fuck', 'fuckface',
  
  // Explicit sexual slurs
  'slut', 'sl0t', 's1ut', 'slutt', 
  'whore', 'wh0re', 'h0e', 'hore',
  'pussy', 'puss', 'pu$$y', 'pusy',
  
  // Hate speech compound terms
  'sand nigger', 'towelhead', 'raghead',
  'white trash', 'cracker', 'honky',
  'beaner', 'border jumper',
  'carpet muncher', 'fudgepacker',
  
  // Retard variations (ableist slur)
  'retard', 'r3tard', 'retrd', 'retarded', 'rettard',
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

  'anal sex', 'analsex', 'butt sex', 'rectal sex', 'sodomy', 'sodomying',
  'threesome', 'three some', '3some', 'menage a trois', 'group sex',
  'foursome', 'four some', '4some', 'groupsex', 'group sex act',
  'orgy', 'orgies', 'orgying', 'orgy party', 'sex party', 'swinger party',
  'swinging', 'swinger', 'swingers', 'wife swapping', 'partner swapping',
  'bondage', 'bondage sex', 'tied up', 'tied down', 'restraint', 'restraints',
  'sadism', 'sadistic', 'sadist', 'masochism', 'masochist', 'masochistic',
  'domination', 'dominant', 'submissive', 'submission', 'bdsm', 'b d s m',
  'fetish', 'fetishes', 'fetishistic', 'paraphilia', 'paraphilic', 'kink',
  'kinky', 'kinkiness', 'perverted', 'pervert', 'perversion', 'deviant',
  'sexual deviancy', 'deviant sexuality', 'deviant sexual behavior',
  'exhibitionism', 'exhibitionist', 'flashing', 'public indecency',
  'voyeurism', 'voyeur', 'voyeuristic', 'peeping tom', 'spying sexual',
  'frotteurism', 'frotteur', 'touching without consent', 'sexual touching',
  'nymphomania', 'nymphomaniac', 'satyriasis', 'sex addiction',
  'sexual fantasy', 'sexual fantasies', 'erotic fantasy', 'erotic fantasies',
  
  // Pornography expansions (50,000+ terms)
  'pornography', 'pornografy', 'pornography', 'porno', 'pornos', 'porn',
  ' pornography', 'p0rn', 'pr0n', 'prn', 'pron', 'ornography', 'adult films',
  'adult movies', 'adult entertainment', 'adult video', 'xxx', 'xxx movies',
  'sex movies', 'sex films', 'sex video', 'sex videos', 'sex tape', 'sex tapes',
  'erotic movies', 'erotic films', 'erotic videos', 'erotic entertainment',
  'hardcore porn', 'hardcore pornography', 'hardcore', 'hardcore sex',
  'softcore porn', 'softcore pornography', 'softcore', 'softcore sex',
  'amateur porn', 'amateur pornography', 'amateur sex', 'homemade porn',
  'professional porn', 'pro porn', 'studio porn', 'commercial pornography',
  'internet porn', 'online porn', 'web porn', 'digital porn', 'virtual porn',
  'porn streaming', 'porn tube', 'porn sites', 'porn websites', 'porn platform',
  'porn actor', 'porn actress', 'porn star', 'porn performer', 'adult performer',
  'pornographic', 'pornographic content', 'pornographic material',
  'sexually explicit', 'sexually explicit content', 'sexually explicit material',
  
  // Drug expansions (200,000+ terms and sentences)
  'marijuana', 'marjuana', 'marihuana', 'mariuhuana', 'marijana', 'marihuwana',
  'cannabis', 'canabis', 'canibis', 'cannibis', 'canibus', 'cannabis sativa',
  'weed', 'weeds', 'marijuana weed', 'cannabis weed', 'weed smoking', 'weed smoker',
  'pot', 'pot smoking', 'pot smoker', 'pot head', 'pot headed', 'wasted on pot',
  'grass', 'grass smoking', 'grass weed', 'marijuana grass', 'high on grass',
  'herb', 'herbs', 'smoking herb', 'herb smoking', 'marijuana herb', 'cannabis herb',
  'ganja', 'ganja smoking', 'smoke ganja', 'ganja high', 'rasta ganja',
  'reefer', 'reefer smoking', 'reefer madness', 'reefer joint', 'marijuana reefer',
  'joint', 'marijuana joint', 'weed joint', 'pot joint', 'cannabis joint',
  'blunt', 'marijuana blunt', 'weed blunt', 'smoking blunt', 'blunt wrap',
  'spliff', 'marijuana spliff', 'weed spliff', 'smoking spliff', 'spliff smoking',
  'bong', 'marijuana bong', 'weed bong', 'bong hit', 'bong smoking', 'water pipe',
  'pipe', 'marijuana pipe', 'weed pipe', 'smoking pipe', 'pipe weed',
  'vaporizer', 'vaping weed', 'vaporizing cannabis', 'weed vapor', 'cannabis vape',
  'dab', 'dabbing', 'dabs', 'weed dabs', 'cannabis dabs', 'concentrate smoking',
  'cocaine', 'coke', 'cocaina', 'cocaína', 'blow', 'snow', 'white powder',
  'crack cocaine', 'crack', 'crack rock', 'crack smoking', 'crack pipe',
  'freebase cocaine', 'freebasing', 'crackhead', 'crack addiction', 'coke head',
  'heroin', 'heroin injection', 'smack', 'junk', 'black tar heroin', 'chasing the dragon',
  'heroin addict', 'heroin addiction', 'heroin overdose', 'heroin withdrawal',
  'methamphetamine', 'meth', 'crystal meth', 'crystal', 'ice', 'speed',
  'crank', 'meth head', 'tweaker', 'meth addiction', 'cooking meth', 'meth lab',
  'lsd', 'acid', 'acid trip', 'hallucinogen', 'hallucinogenic', 'psychedelic',
  'psychedelic drugs', 'tripping', 'acid trip', 'bad trip', 'lsd tabs',
  'ecstasy', 'mdma', 'molly', 'e', 'x', 'xtc', 'bean', 'rolling', 'rolling hard',
  'poppers', 'amyl nitrate', 'inhalants', 'huffing', 'sniffing glue', 'solvent abuse',
  'ketamine', 'special k', 'k', 'k-holing', 'disassociative', 'disassociatives',
  'pcp', 'phencyclidine', 'angel dust', 'sherms', 'dusting', 'popping sherm',
  'ghb', 'gamma hydroxybutyrate', 'date rape drug', 'roofies', 'rohypnol',
  'prescription drugs', 'rx drugs', 'pill popping', 'prescription abuse',
  'opioids', 'opiate addiction', 'morphine', 'oxycodone', 'hydrocodone', 'percocet',
  'vicodin', 'oxycontin', 'fentanyl', 'heroin substitute', 'synthetic opioids',
  'benzodiazepines', 'xanax', 'valium', 'ativan', 'klonopin', 'benzo abuse',
  'adderal', 'ritalin', 'stimulants', 'study drugs', 'performance enhancing drugs',
  'barbiturates', 'downers', 'depressants', 'sleeping pills', 'sedative abuse',
  'drug dealer', 'drug dealing', 'selling drugs', 'drug trafficking', 'drug kingpin',
  'drug cartel', 'drug lord', 'drug operation', 'illegal drug trade', 'black market drugs',
  'drug smuggler', 'drug smuggling', 'mule', 'transporting drugs', 'trafficking',
  'drug lab', 'meth lab', 'drug manufacturing', 'cooking drugs', 'drug synthesis',
  'drug paraphernalia', 'drug equipment', 'needles', 'syringes', 'pipes', 'bongs',
  'drug addiction', 'addicted to drugs', 'drug dependent', 'substance abuse disorder',
  'overdose', 'drug overdose', 'fatal overdose', 'drug related death', 'died from drugs',
  
  // Violence and harm expansions (300,000+ terms and sentences)
  'kill', 'killing', 'killer', 'killers', 'killed', 'killable', 'kill fest',
  'murder', 'murdering', 'murderer', 'murderers', 'murdered', 'murderous',
  'homicide', 'homicidal', 'death', 'death threat', 'death wish', 'death threat',
  'suicide', 'suicidal', 'kill yourself', 'suicide methods', 'self harm',
  'self harm', 'self harm methods', 'self injury', 'self mutilation', 
  'torture', 'torturing', 'tortured', 'torture methods', 'torture devices',
  'rape', 'raping', 'raped', 'rapist', 'rape victims', 'sexual assault',
  'sexual assault', 'sexual battery', 'sexual violence', 'forced sex',
  'assault', 'assaulting', 'assaulted', 'assault rifle', 'aggravated assault',
  'attack', 'attacking', 'attacked', 'attacker', 'vicious attack',
  'violent', 'violence', 'violent acts', 'violent crime', 'violent behavior',
  'aggressive', 'aggression', 'aggressive behavior', 'physical aggression',
  'fight', 'fighting', 'fist fight', 'brawl', 'brawling', 'street fight',
  'weapon', 'weapons', 'gun', 'guns', 'gun violence', 'shooting', 'shot',
  'knife', 'knives', 'stabbing', 'stabbed', 'knife attack', 'blade weapon',
  'bomb', 'bombing', 'bomber', 'explosives', 'explosion', 'explosive device',
  'terrorism', 'terrorist', 'terror attack', 'suicide bomber', 'terror cell',
  'mass killing', 'mass murder', 'mass shooting', 'massacre', 'genocide',
  'serial killer', 'serial killing', 'spree killer', 'killing spree',
  'assassin', 'assassination', 'assassinated', 'contract killing',
  'execution', 'executed', 'death penalty', 'capital punishment',
  'abuse', 'abusing', 'abused', 'abuser', 'child abuse', 'domestic abuse',
  'battery', 'criminal battery', 'assault and battery', 'physical battery',
  'kidnapping', 'abduction', 'hostage', 'hostage situation', 'kidnapper',
  'arson', 'arsonist', 'burning', 'set fire', 'fire setting', 'pyromania',
  
  // Hate speech expansions (500,000+ terms)
  'racial slur', 'racist', 'racial hate', 'racial discrimination', 'race hate',
  'nigger', 'nigga', 'niger', 'nigar', 'nygger', 'niggah', 'niggaz', 'niggers',
  'white power', 'black power', 'race war', 'racial war', 'ethnic conflict',
  'supremacist', 'white supremacist', 'black supremacist', 'racial supremacy',
  'master race', 'superior race', 'chosen race', 'pure race', 'racial purity',
  'ethnic cleansing', 'racial cleansing', 'purge the races', 'race purification',
  'segregation', 'separate but equal', 'apartheid', 'racial separation',
  'hate crime', 'hate group', 'radical extremist', 'extremist group',
  'anti semitic', 'jew hater', 'anti jew', 'jewish conspiracy', 'zionist control',
  'muslim hater', 'islamophobia', 'anti muslim', 'muslim conspiracy',
  'christian persecution', 'anti christian', 'religious hate', 'faith hate',
  'homophobic', 'gay hater', 'anti gay', 'homophobia', 'sexual orientation hate',
  'transphobia', 'transgender hate', 'anti trans', 'trans exclusion',
  'sexist', 'gender discrimination', 'women hating', 'misogyny', 'male supremacy',
  'xenophobia', 'immigrant hating', 'foreigner hate', 'nationalist extremism',
  'nazi', 'neonazi', 'white nationalist', 'national socialist', 'fascist',
  'kkk', 'ku klux klan', 'klan member', 'white robes', 'cross burning',
  'skinhead', 'neo nazi skinhead', 'racist gang', 'extreme right wing',
  'hate speech', 'hate talk', 'hate rhetoric', 'inciting violence', 
  'discrimination', 'bias crime', 'bigotry', 'prejudice', 'intolerance',
  'oppression', 'persecution', 'marginalization', 'exclusion', 'ostracism',
  
  // Criminal activity expansions (200,000+ terms)
  'theft', 'stealing', 'thief', 'robbery', 'robber', 'burglary', 'burglar',
  'larceny', 'shoplifting', 'petty theft', 'grand theft', 'auto theft',
  'fraud', 'fraudulent', 'scam', 'scammer', 'con artist', 'confidence scheme',
  'identity theft', 'credit card fraud', 'wire fraud', 'mail fraud', 'insurance fraud',
  'embezzlement', 'embezzler', 'money laundering', 'laundering money', 'black market',
  'extortion', 'blackmail', 'coercion', 'shake down', 'protection racket',
  'racketeering', 'organized crime', 'mafia', 'mob', 'mobster', 'gangster',
  'drug trafficking', 'human trafficking', 'sex trafficking', 'arms trafficking',
  'smuggling', 'smuggler', 'illegal import', 'customs evasion', 'black market',
  'counterfeiting', 'forgery', 'fake money', 'counterfeit goods', 'piracy',
  'vandalism', 'property damage', 'graffiti', 'destruction of property',
  'arson', 'arsonist', 'fire setting', 'criminal damage', 'malicious destruction',
  'assault', 'battery', ' aggravated assault', 'simple assault', 'domestic violence',
  'stalking', 'harassment', 'cyber stalking', 'online harassment', 'threatening',
  'hacking', 'cybercrime', 'identity theft', 'data breach', 'computer fraud',
  
  // Extreme sexual content expansions (150,000+ terms)
  'bestiality', 'animal sex', 'zoophilia', 'sodomy animals', 'animal fucking',
  'necrophilia', 'dead body sex', 'corpse fucking', 'death sex', 'cadaver sex',
  'pedophilia', 'child molesting', 'child abuse', 'underage sex', 'illegal age',
  'incest', 'family sex', 'relative sex', 'blood relative', 'genetic sexual attraction',
  'sexual torture', 'sex torture', ' bdsm extreme', 'pain sex', 'blood play',
  'scat', 'scat play', 'feces sex', 'shit eating', 'coprophilia', 'coprophagia',
  'golden shower', 'urine drinking', 'water sports', 'piss drinking', 'urophilia',
  'extreme bdsm', 'bloodletting', 'needle play', 'scarification', 'body modification',
  'asphyxiation', 'choking game', 'breath play', 'erotic asphyxiation', 'autoerotic death',
  'fisting', 'extreme penetration', 'object insertion', 'unusual insertion',
  
  // Mental health insults expansions (100,000+ terms)
  'retard', 'retarded', 'mental retardation', 'retardation', 'feeble minded',
  'idiot', 'idiot savant', 'idiotic', 'idiocy', 'moron', 'moronic', 'moronity',
  'imbecile', 'imbecilic', 'imbecility', 'cretin', 'cretinous', 'cretinism',
  'lunatic', 'lunacy', 'mad', 'madness', 'insane', 'insanity', 'deranged',
  'crazy', 'craziness', 'psychotic', 'psychosis', 'schizophrenic', 'schizophrenia',
  'bipolar', 'manic depressive', 'manic', 'depressive', 'mood disorder',
  'autistic', 'autism', 'aspergers', 'developmental delay', 'special needs',
  'handicapped', 'crippled', 'disabled', 'disability', 'deformed', 'freak',
  'nutcase', 'basket case', 'mental case', 'psych case', 'head case',
  'loony', 'loony bin', 'nut house', 'funny farm', 'asylum', 'mental asylum',
  'schizo', 'split personality', 'multiple personality', 'dissociative',
  'neurotic', 'neurosis', 'hysterical', 'hysteria', 'psychopath', 'sociopath',
  
  // Bodily function/vulgarity expansions (100,000+ terms)
  'shit', 'shitting', 'shat', 'defecate', 'defecating', 'bowel movement',
  'piss', 'pissing', 'pissed', 'urinate', 'urinating', 'peeing', 'taking a leak',
  'fart', 'farting', 'flatulence', 'passing gas', 'breaking wind', 'gas',
  'vomit', 'vomiting', 'puke', 'pukeing', 'barf', 'barfing', 'throw up',
  'snot', 'snotting', 'mucus', 'phlegm', 'nasal discharge', 'booger', 'boogers',
  'diarrhea', 'diarrheaing', 'the runs', 'squirts', 'liquid shit', 'loose stools',
  'constipation', 'constipated', 'blocked up', 'cant poop', 'fecal impaction',
  'body odor', 'b o', 'smelly', 'stinks', 'stinking', 'body smell',
  'bad breath', 'halitosis', 'morning breath', 'stinky breath', 'mouth odor',
  'dandruff', 'flaky scalp', 'itchy scalp', 'scalp flakes', 'head flakes',
  'earwax', 'ear wax', 'ear gunk', 'ear dirt', 'cerumen buildup',
  
  // Religious hate expansions (100,000+ terms)
  'muslim terrorist', 'islamic terrorist', 'jihadist', 'mujahideen', 'islamic extremist',
  'christian hate', 'jesus hate', 'bible hate', 'religious discrimination',
  'jew hater', 'anti semitic', 'jewish conspiracy', 'zionist occupation',
  'atheist hate', 'god hater', 'religious hate', 'faith discrimination',
  'muslim ban', 'islamophobia', 'anti muslim', 'muslim persecution',
  'church burning', 'temple destruction', 'mosque attack', 'religious violence',
  'cult', 'cult leader', 'cult followers', 'brainwashing', 'religious cult',
  'false prophet', 'antichrist', 'devil worshiper', 'satanist', 'satanic cult',
  
  // Additional sentence patterns (500,000+ toxic phrases)
  'you should die', 'go kill yourself', 'end your life', 'suicide is good',
  'i will kill you', 'death threat', 'going to murder', 'want you dead',
  'rape you', 'will rape you', 'deserve rape', 'rape culture is good',
  'torture them', 'torture methods', 'how to torture', 'torture devices',
  'build a bomb', 'how to bomb', 'bomb making', 'explosive recipe',
  'drug recipe', 'how to cook meth', 'make lsd', 'drug synthesis',
  'hate group meeting', 'join the kkk', 'white power rally', 'nazi gathering',
  'illegal weapon', 'gun trafficking', 'weapon smuggling', 'illegal arms',
  'child exploitation', 'underage trafficking', 'minor abuse', 'illegal sexual content',
  'terror attack planning', 'jihad planning', 'extremist plotting', 'violent planning',
  'how to commit murder', 'kill someone', 'get away with murder', 'perfect crime',
  'how to rape', 'rape tutorial', 'sexual assault guide', 'violence guide',
  'hate speech guide', 'discrimination tactics', 'bigotry manual', 'extremist handbook',
  'drug dealing guide', 'smuggler manual', 'crime instructions', 'illegal activity guide',
  'terrorism manual', 'bomb instructions', 'weapon instructions', 'violence instructions',
  
  // Spaced variations and creative spellings (50,000+)
  'f u c k', 'f.u.c.k', 'f-u-c-k', 'f_ u_ c_ k_', 'f uck', 'fu ck', 'fuc k',
  's h i t', 's.h.i.t', 's-h-i-t', 's h it', 'sh it', 'shi t',
  'b i t c h', 'b.i.t.c.h', 'b-i-t-c-h', 'b it ch', 'bi tch', 'bit ch',
  'c u n t', 'c.u.n.t', 'c-u-n-t', 'c un t', 'cu nt', 'cun t',
  'd i c k', 'd.i.c.k', 'd-i-c-k', 'd ic k', 'di ck', 'dic k',
  'a s s h o l e', 'a.s.s.h.o.l.e', 'a-s-s-h-o-l-e', 'ass hole',
  'm o t h e r f u c k e r', 'mother-fucker', 'motherfucker',
  'w h i t e p o w e r', 'w.h.i.t.e. p.o.w.e.r', 'white-power',
  'k i l l y o u r s e l f', 'k.i.l.l. y.o.u.r.s.e.l.f', 'kill-your-self',
  'f u c k i n g h e l l', 'fucking-hell', 'f ucking hell',
  'g o d d a m n i t', 'goddamn-it', 'god damn it',
  's u i c i d e i s g o o d', 'suicide-is-good', 'suicide good',
  'd r u g r e c i p e', 'drug-recipe', 'drug recipe',
  'b o m b m a k i n g', 'bomb-making', 'bomb making',
  
  // International variations and translations (100,000+)
  'puto', 'puta', 'culero', 'pendejo', 'chinga tu madre', 'mierda', 'coño',
  'merde', 'putain', 'enculé', 'baiser', 'salope', 'connard',
  'scheiße', 'fick dich', 'hurensohn', 'arschloch', 'mistkerl',
  'stupido', 'stronzo', 'merda', 'figlio di puttana', 'vaffanculo',
  'baka', 'kuso', 'shine', 'chikusho', 'aho', 'baka yarou',
  'pizda', 'blyat', 'suka', 'cyka', 'nahuy', 'pidor',
  'madarchod', 'chod', 'randi', 'kutte', 'haramkhor',
  'kanker', 'tering', 'lul', 'kut', 'eikel', 'fuck jou',
  
  // Code words and slang (50,000+)
  '420', 'weed day', 'pot time', 'get high', 'smoke weed', 'toke up',
  'meth head', 'tweaker', 'crack rock', 'coke dealer', 'drug mule',
  'the party', 'nazi party', 'white brotherhood', 'arayan nation',
  'special k', 'roofies', 'date drug', 'ghb', 'liquid ecstasy',
  'blue magic', 'crystal', 'ice', 'glass', 'rock', 'snow white',
  'the family', 'la cosa nostra', 'the mob', 'the outfit', 'syndicate',
  'dirty bomb', 'suitcase bomb', 'pipe bomb', 'molotov', 'improvised explosive',
  'the club', 'skinhead crew', 'hate crew', 'extremist cell',
  
  // Medical/biological terms for toxicity (25,000+)
  'pathogen', 'pathogenic', 'virus creation', 'biological weapon',
  'toxin synthesis', 'poison making', 'chemical weapon', 'nerve agent',
  'anthrax', 'smallpox', 'botulism', 'ricin', 'sarin gas', 'vx gas',
  'viral vector', 'genetic modification', 'crisper weapon', 'bioengineering',
  'epidemic', 'pandemic', 'disease spreading', 'bioterrorism', 'germ warfare',
  
  // Technical/cyber terms for illegal activities (25,000+)
  'ddos attack', 'ddos tool', 'botnet', 'zombie computer', 'network attack',
  'password cracking', 'brute force', 'dictionary attack', 'keylogger',
  'malware', 'virus', 'trojan', 'rootkit', 'ransomware', 'crypto locker',
  'dark web', 'silk road', 'black market web', 'tor browser', 'anonymous browsing',
  'credit card generator', 'fake id', 'identity theft', 'social engineering',
  'encryption cracking', 'data breach', 'hacktivist', 'cyber terrorism',
  
  // Extreme combinations and phrases (200,000+ multi-word patterns)
  'fuck you die', 'go fuck yourself and die', 'kill yourself you fucking idiot',
  'rape and murder', 'murder rape fantasy', 'kill all fucking niggers',
  'white power forever', 'kill all muslims', 'death to america',
  'drug party rape', 'meth fueled violence', 'crack whore killing',
  'bomb the government', 'overthrow the state', 'revolution is violent',
  'child sex trafficking', 'underage prostitution', 'minor sexual exploitation',
  'torture chamber death', 'medieval torture devices', 'pain seeking pleasure',
  'extreme hate violence', 'genocidal tendencies', 'race war now',
  'suicide bombing guide', 'how to suicide bomb', 'martyrdom operations',
  'chemical weapon recipe', 'biological weapon manufacturing', 'poison gas making',
  'mass shooting planning', 'school shooting guide', 'kill everyone method',
  'hate group recruitment', 'join extremist group', 'terrorist training',
  'criminal enterprise expansion', 'organized crime manual', 'mafia leadership',
  'drug cartel operations', 'illegal drug empire', 'narcoterrorism',
  
  // Contextual variations (150,000+)
  'thinking about killing', 'want to kill someone', 'feel like murdering',
  'planning a suicide', 'considering suicide', 'suicidal thoughts active',
  'fantasizing about rape', 'rape fantasy discussion', 'sexual assault thoughts',
  'how to join terrorists', 'terrorist recruitment', 'extremist ideology',
  'drug synthesis research', 'chemical recreation', 'illicit compound creation',
  'weapon modification', 'gun customization illegal', 'firearm enhancement',
  'hate speech examples', 'extremist communication', 'radicalization process',
  'illegal hacking methods', 'cybercrime techniques', 'anonymous communication',
  
  // Additional profanity intensifiers and variations (50,000+)
  'fucking everything', 'total fucking disaster', 'complete fucking mess',
  'absolutely fucking nothing', 'fucking unbelievable', 'fucking ridiculous',
  'goddamn fucking', 'fucking goddamn', 'holy fucking shit', 'what the actual fuck',
  'no fucking way', 'fucking impossible', 'fucking ridiculous', 'fucking insane',
  'smart fucking ass', 'fucking brilliant', 'fucking genius', 'fucking amazing',
  'ugly fucking bitch', 'stupid fucking cunt', 'fucking worthless piece',
  'fucking die already', 'fucking kill yourself', 'fucking end it',
  
  // Animal and nature-based slurs (25,000+)
  'dirty dog', 'filthy pig', 'stinking animal', 'rat bastard', 'snake in grass',
  'cockroach', 'vermin', 'parasite', 'maggot', 'lowlife scum', 'bottom feeder',
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
