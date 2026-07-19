const LOWER   = "abcdefghijklmnopqrstuvwxyz";
const UPPER   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS  = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

export const GENERATOR_LENGTH_MIN = 8;
export const GENERATOR_LENGTH_MAX = 32;
export const PASSPHRASE_WORDS_MIN = 3;
export const PASSPHRASE_WORDS_MAX = 6;

export interface PasswordGeneratorOptions {
  length:  number;
  upper:   boolean;
  digits:  boolean;
  symbols: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 16, upper: true, digits: true, symbols: true,
};

/** Uses crypto.getRandomValues (not Math.random) — this generates real account passwords. */
export function generatePassword(options: PasswordGeneratorOptions): string {
  let pool = LOWER;
  if (options.upper)   pool += UPPER;
  if (options.digits)  pool += DIGITS;
  if (options.symbols) pool += SYMBOLS;

  const bytes = new Uint32Array(options.length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => pool[b % pool.length]).join("");
}

/** A compact diceware-style wordlist (common, unambiguous English words, 3-8 letters, no
 * lookalikes) for passphrase-mode generation — not exhaustive like EFF's 7776-word list, but
 * ~350 words still gives ~8.5 bits/word, so a 5-word passphrase lands around 42 bits of entropy. */
const WORDLIST = [
  "abbey","acid","acorn","actor","adept","agile","alarm","album","alert","alloy",
  "almond","alpine","amber","anchor","angle","ankle","apple","apron","arbor","arch",
  "arctic","armor","arrow","art","ash","aspen","atlas","atom","aunt","autumn",
  "avocado","axis","badge","bagel","baker","balloon","bamboo","banjo","barn","basil",
  "basket","beacon","beam","bean","bear","beaver","bell","belt","bench","berry",
  "bike","birch","bison","blanket","blaze","blend","blimp","block","bloom","blossom",
  "blue","boat","bolt","bone","bonfire","book","boot","border","botany","bottle",
  "boulder","branch","brave","bread","breeze","brick","bridge","bright","broom","brush",
  "bubble","bucket","buckle","budget","bugle","bulb","bundle","bunny","burrow","cabin",
  "cable","cactus","cake","camel","camp","canal","candle","candy","canoe","canvas",
  "canyon","cape","captain","carbon","card","cargo","carpet","carrot","castle","cave",
  "cedar","cellar","chalk","charm","chart","cheese","cherry","chess","chestnut","chill",
  "chimney","circle","clamp","clay","cliff","cloak","clover","cobalt","coconut","coffee",
  "comet","compass","copper","coral","corner","cotton","couch","cousin","cove","coyote",
  "crane","crater","cream","creek","crescent","crest","cricket","crimson","crown","crystal",
  "cub","cup","curl","current","cypress","daisy","dawn","deer","delta","denim",
  "desert","desk","diamond","dolphin","dome","donkey","dove","dragon","drift","drum",
  "dune","eagle","echo","eddy","elbow","elm","ember","emerald","engine","envelope",
  "falcon","feather","fern","field","finch","fireplace","flame","flannel","fleet","flint",
  "flower","flute","fog","forest","forge","fossil","fountain","fox","frost","garden",
  "garnet","gate","gazelle","gecko","gem","ginger","glacier","glade","glider","globe",
  "glow","goat","gorge","granite","grape","gravel","grove","gull","hamlet","hammer",
  "harbor","harp","hawk","hazel","heron","hickory","hill","holly","honey","hornet",
  "hound","hummingbird","husky","ibis","ice","igloo","indigo","inlet","ivory","ivy",
  "jade","jasmine","jelly","jewel","jungle","juniper","kayak","kestrel","kettle","kite",
  "koala","lagoon","lake","lantern","larch","lark","laurel","lavender","leaf","lemon",
  "lentil","lighthouse","lilac","lily","lime","linen","lion","lizard","llama","lobster",
  "locust","lotus","lumber","lynx","magnet","magpie","mango","maple","marble","marigold",
  "marsh","meadow","melon","mesa","meteor","mint","mirror","mist","mitten","moon",
  "moose","moss","mountain","mulberry","mushroom","myrtle","narwhal","nectar","needle","nest",
  "nickel","noodle","nutmeg","oak","oasis","ocean","olive","onyx","opal","orange",
  "orbit","orchard","orchid","osprey","otter","owl","oyster","paddle","panther","papaya",
  "parrot","peach","peacock","pearl","pebble","pecan","pelican","penguin","pepper","petal",
  "pine","pixel","plateau","plum","poppy","porcupine","poplar","prairie","prism","puffin",
  "pumpkin","quail","quartz","quill","rabbit","raccoon","radish","rainbow","raven","reed",
  "reef","ridge","river","robin","rocket","rose","rowan","ruby","saddle","saffron",
  "sage","salmon","sandal","sapphire","satin","scarf","seed","sequoia","shadow","shale",
  "shell","shore","shrimp","silver","sky","sled","sloth","slope","snail","snow",
  "sorrel","sparrow","spice","sponge","spring","spruce","squirrel","stag","star","stone",
  "stork","stream","summit","sunflower","swan","sycamore","tangerine","teal","terrace","thistle",
  "thunder","tide","tiger","timber","toast","topaz","toucan","trail","trellis","trout",
  "tulip","tundra","turtle","umber","valley","vanilla","velvet","venture","violet","volcano",
  "walnut","walrus","warbler","wave","wheat","whisper","willow","wisteria","wolf","woodland",
  "wren","yarrow","yew","zebra","zephyr","zinnia",
] as const;

/** RFC-6238-style passphrase generator (Bitwarden/1Password-style secondary mode), e.g.
 * "cedar-otter-lagoon-prism". Uses crypto.getRandomValues for uniform word selection. */
export function generatePassphrase(wordCount: number): string {
  const indices = new Uint32Array(wordCount);
  crypto.getRandomValues(indices);
  return Array.from(indices, (i) => WORDLIST[i % WORDLIST.length]).join("-");
}
