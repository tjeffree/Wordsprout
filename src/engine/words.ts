/**
 * Wordsprout content library: gentle, kid-safe words for a storybook garden.
 * Everything here is plain ASCII.
 */

export interface WordEntry {
  text: string;
  emoji?: string;
}

/** Split a whitespace separated block into a list of words. */
const w = (block: string): string[] => block.split(/\s+/).filter((s) => s.length > 0);

/** Split a block into one trimmed entry per non-empty line. */
const lines = (block: string): string[] =>
  block
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Cumulative key-introduction stages for beginners, home row first. Each stage lists the NEW keys added. */
export const LETTER_STAGES: string[][] = [
  ['f', 'j'],
  ['d', 'k'],
  ['s', 'l'],
  ['a'],
  ['g', 'h'],
  ['e', 'i'],
  ['r', 'u'],
  ['t', 'y'],
  ['o'],
  ['n'],
  ['c', 'm'],
  ['w', 'p'],
  ['v', 'b'],
  ['q', 'x', 'z'],
];

const pw = (text: string, emoji: string): WordEntry => ({ text, emoji });

/** 3-letter picture words for early readers; every entry has an emoji. */
export const PICTURE_WORDS: WordEntry[] = [
  pw('cat', '\u{1F431}'),
  pw('dog', '\u{1F436}'),
  pw('sun', '☀️'),
  pw('bee', '\u{1F41D}'),
  pw('hat', '\u{1F3A9}'),
  pw('egg', '\u{1F95A}'),
  pw('pig', '\u{1F437}'),
  pw('cow', '\u{1F42E}'),
  pw('hen', '\u{1F414}'),
  pw('fox', '\u{1F98A}'),
  pw('owl', '\u{1F989}'),
  pw('ant', '\u{1F41C}'),
  pw('bat', '\u{1F987}'),
  pw('bug', '\u{1F41B}'),
  pw('pie', '\u{1F967}'),
  pw('nut', '\u{1F95C}'),
  pw('tea', '\u{1F375}'),
  pw('ice', '\u{1F9CA}'),
  pw('key', '\u{1F511}'),
  pw('bed', '\u{1F6CF}️'),
  pw('bus', '\u{1F68C}'),
  pw('car', '\u{1F697}'),
  pw('van', '\u{1F690}'),
  pw('map', '\u{1F5FA}️'),
  pw('pen', '\u{1F58A}️'),
  pw('box', '\u{1F4E6}'),
  pw('bag', '\u{1F45C}'),
  pw('cap', '\u{1F9E2}'),
  pw('tie', '\u{1F454}'),
  pw('toy', '\u{1F9F8}'),
  pw('gem', '\u{1F48E}'),
  pw('log', '\u{1FAB5}'),
  pw('ear', '\u{1F442}'),
  pw('eye', '\u{1F441}️'),
  pw('leg', '\u{1F9B5}'),
  pw('arm', '\u{1F4AA}'),
  pw('red', '\u{1F534}'),
  pw('ten', '\u{1F51F}'),
  pw('hut', '\u{1F6D6}'),
  pw('fir', '\u{1F332}'),
  pw('ram', '\u{1F40F}'),
  pw('ewe', '\u{1F411}'),
  pw('pup', '\u{1F415}'),
  pw('tub', '\u{1F6C1}'),
  pw('mug', '☕'),
  pw('pan', '\u{1F373}'),
  pw('yum', '\u{1F60B}'),
  pw('cog', '⚙️'),
  pw('sea', '\u{1F30A}'),
  pw('oak', '\u{1F333}'),
  pw('elf', '\u{1F9DD}'),
  pw('boy', '\u{1F466}'),
  pw('man', '\u{1F468}'),
  pw('kid', '\u{1F9D2}'),
  pw('mum', '\u{1F469}'),
  pw('hug', '\u{1F917}'),
  pw('fog', '\u{1F32B}️'),
  pw('new', '\u{1F195}'),
  pw('top', '\u{1F51D}'),
  pw('yam', '\u{1F360}'),
  pw('dew', '\u{1F4A7}'),
  pw('doe', '\u{1F98C}'),
  pw('sax', '\u{1F3B7}'),
  pw('tag', '\u{1F3F7}️'),
  pw('cab', '\u{1F695}'),
  pw('run', '\u{1F3C3}'),
  pw('ink', '\u{1F58B}️'),
  pw('tap', '\u{1F6B0}'),
  pw('pin', '\u{1F4CC}'),
  pw('sad', '\u{1F622}'),
  pw('mic', '\u{1F3A4}'),
  pw('zap', '⚡'),
];

/** Common short words of 2-4 letters (5 allowed for the home-row subset). */
export const SHORT_WORDS: string[] = w(`
am an as at be by do go he hi if in is it me my no of oh on or so to up us we
ant ape arm art bag bat bed bee big bin bit box bud bug bus but buy can cap car cat cod cow cub cup cut
day dew dig dog dot dry due ear eat egg end eye fan far fig fin fit fix fly fog fox fun gap gem get got gum
hat hen her hid him his hop hot hug ice ink jam jar jet job joy key kid kit lap leg let lid lip log lot low
map mat men mix mud mug nap net new nut oak oar odd oil old one our out owl pad pan paw pea pen pet pie pig
pin pop pot pup rag rat red rib rim rug run sad say sea see set she shy sip sit sky sun tap tea ten the tin
tip toe top toy tub two use van wax way web wet who why win wow yak yes yet you zip zoo
arch bake barn bark bean bear bees bell bird blue boat book bowl bush cake calm camp card care cave chat
chip city clap clay clip coat cold corn cozy crab crow cube dawn deer dish dive door dove down drip drum
duck dust dune east farm fawn fern fire fish flap flow foam fork frog fuzz gate gift glow gold goat grow
gust hare harp heal hill hive home hood hope hops jump kind kite lake lamb lamp leaf lily lime lion loaf
love luck mail make mint moon moss moth nest nice note oats pail palm park path pear pine play plum pond
pool puff rain rake rice ride ring rose sail sand seed ship sing skip slow snow soft song star stem swan
swim tail tale tent tide tree tuna twig vine wave wind wing wish wood wool yarn yawn zoom fair game gaze
glue gown hair hand hang hats help here idea iris joke keep kiss knit lace lazy lend lift like line list
look lost mild milk mist mole more much neat next nook nuts open oval pack page pale pass peek pick pink
plan plot pour pull push quiz race read real rest roam roll roof room root rule safe same seal seek side
sign silk sled snap soap sock soil soon sort soup spin spot stay step stop such tall teal tell that them
then they this tiny tray true tune turn twin upon very view wake walk warm wash well what when whim wide
wild will wins wipe with wren your yolk yoga zany zero zest
dad all fall lads flag glad hall ask salad add ads gas gag had has lad lag sag dash gash lash half
hash asks adds alas gala lass sash falls halls flask glass flash shall slash ash fad gal gals dads slag
`);

/** 5-6 letter words, themed toward garden, animals, weather, food, magic. */
export const MEDIUM_WORDS: string[] = w(`
petal bloom daisy tulip lilac pansy poppy clover meadow garden flower sprout seeds leafy stems roots
grass ferns herbs basil thyme chive violet orchid lotus peony aster bulbs twigs acorn branch shrub
hedge hills fields brook creek pebble stone rocks trail fence porch trowel spade water rainy
sunny misty windy snowy cloud breeze frost shower puddle sunset stars skies gusty foggy cloudy chilly
bunny rabbit puppy kitten snail beetle bumble honey mouse otter badger robin finch owlet
ducks goose geese goats sheep lambs horse ponies piglet chick chicks kitty tabby fluffy furry woolly
wings tails turtle froggy minnow trout salmon whale pearl coral pigeon parrot puffin heron
crane stork cygnet moose llama alpaca panda koala zebra tiger monkey lemur sloth camel donkey ferret
beaver buzzy apple peach plums pears grape lemon mango melon berry cherry banana orange fruit juice
bread toast butter cheese cream cocoa candy sweet sugar syrup cakes cookie muffin scone pastry crumb
crust dough flour pizza pasta noodle salad carrot potato tomato onion radish turnip beans wheat
cereal waffle bagel donut fudge jelly mints lolly treat snack lunch dinner picnic basket teapot
teacup sauce spoon plate napkin magic charm spell wizard fairy elves gnome pixie sprite wands wishes
dream dreams shine shiny glows potion castle tower crown jewel fable story tales legend wonder
marvel bright cheery merry jolly happy giggle smile laugh cheer hooray hello thanks please friend
buddy cuddle gentle kindly about above after again along among beach begin below black brown build
carry catch child clean clear climb close color could count cover dance drink early earth enjoy
every fresh funny giant given glass going great green group heart house large later learn light
listen little lively music never night other paint party piano plant point quick quiet raise reach
ready river round shade shape share sleep small speak spend stand start swing table thank their
there these thing think those three today under until usual voice where which while white whole
world young yummy mossy bumbly petals bloomy crispy 
raisin fennel lilies blooms plants sprays leaves ripple willow maple cedar
birch aspen hazel almond walnut pecans cashew lupine yellow purple acorns
cuddly sleepy dozing napped yawns kettle jammy cotton fabric ribbon button
mitten scarf boots pillow candle cabin bridge window
`);


/** 7-11 letter words. */
export const LONG_WORDS: string[] = w(`
butterfly raspberry lighthouse marshmallow strawberry blueberry blackberry dandelion sunflower
buttercup bluebell daffodil snowdrop foxglove honeysuckle lavender rosemary chamomile hollyhock
marigold primrose wildflower greenhouse scarecrow wheelbarrow rainbow sunshine moonlight starlight
twilight daybreak sunrise morning evening afternoon raindrop snowflake whisper waterfall riverbank
treetop hilltop hillside mountain woodland wildlife hedgehog squirrel chipmunk ladybird ladybug
dragonfly grasshopper caterpillar firefly honeybee beehive bumblebee songbird hummingbird
nightingale woodpecker blackbird bluebird goldfinch kingfisher penguin pelican flamingo peacock
elephant giraffe kangaroo dolphin seahorse starfish jellyfish goldfish porcupine hamster pancake
pancakes cupcake gingerbread shortbread cinnamon vanilla chocolate caramel peppermint spearmint
lemonade sandwich cucumber pumpkin broccoli cabbage spinach tomatoes potatoes blueberries
cranberry pineapple coconut watermelon tangerine clementine apricot nectarine pomegranate
elderflower magical enchanted wonderful beautiful cheerful colorful friendly fantastic delightful
marvelous sparkling shimmering glittering twinkling dazzling whimsical imagination adventure
treasure storybook fairytale bedtime teatime playtime playground swinging jumping dancing singing
laughing giggling hugging wishing dreaming sunbeam teaspoon biscuit crumpet umbrella raincoat
mittens blanket cushion lantern cottage windmill orchard vineyard pasture haystack barnyard
farmyard tractor postcard envelope bicycle tricycle sailboat rowboat balloon lollipop jellybean
marmalade holiday birthday celebrate friendship together neighbor welcome grateful
thankful kindness sharing snuggle snuggly lullaby slumber blossom blossoms daydream
daydreams gardener gardening seedling seedlings sprouting growing blooming flowering paintbrush
watercolor crayons notebook bookshelf bookworm bluebonnet buttercups moonflower evergreen
rosebush raspberries gooseberry mulberry persimmon huckleberry sweetheart teddybear snowfall
raincloud rainstorm sunbeams moonbeam moonbeams stardust sandcastle seashell seashells
shoreline harbour seagull beachball paddling splashing puddles treehouse tiptoes tiptoeing
cartwheel somersault hopscotch skipping skipped whistling humming strolling wandering wondering
`);

/** Capitalised proper nouns for the capitals stage. */
export const CAPITAL_WORDS: string[] = w(`
Pip Clover Bumble Poppy Willow Hazel Juniper Fern Basil Olive Maple Daisy Rosie Tilly Milo Nina Oscar
Penny Ruby Sunny Teddy Wren Violet Barley Biscuit Button Cocoa Dot Elsie Figgy Ginger Honey Ivy
Jasper Kit Lulu Marlow Nutmeg Peach Quince Rowan Sage Thistle Toby Uma Winnie Yara Zinnia Mossy
Pebble Acorn Bramble Cricket Dewdrop Echo Finch Gus Hattie Iris Jelly Kiki Lottie Mabel Nellie Opal
Plum Pudding Robin Skye Tansy Wisp Marigold Primrose Sorrel Heather Hollow Meadow Brookside
Dandelion Fernwood Honeywood Sunnyvale Willowbrook Clovermead Pipkin Tulip Bluebell Moss Bobbin
January February March April May June July August September October November December
Monday Tuesday Wednesday Thursday Friday Saturday Sunday
`);

/** Short whimsical lowercase phrases of 2-4 words, no punctuation. */
export const PHRASES: string[] = lines(`
bees love clover
snail in a hat
tea for two
jam on toast
a tiny acorn
the sleepy moon
sunny meadow
dancing daisies
a splashy puddle
the happy hedgehog
warm apple pie
a basket of berries
soft green moss
ducks in boots
wish on a star
rainbow after rain
the friendly frog
buttercup yellow
hello little seed
a cozy blanket
sleepy snail
fluffy white clouds
a ladybug picnic
honey on bread
tulips in spring
bunny in a scarf
the singing robin
marshmallow clouds
a garden gate
walking in the rain
mouse with umbrella
sparkly dewdrops
the giggling brook
pink cherry blossoms
teapot full of tea
butterfly wings
snuggle with a kitten
dandelion wishes
hat full of flowers
the quiet pond
a pocket of pebbles
cupcakes and cocoa
lemonade on the porch
owl in a nightcap
bumblebee buzz
pie for a friend
fresh baked bread
the kind old oak
mittens for a mouse
three little ducks
hop skip jump
a fairy ring
under the mushroom
goat in a coat
jolly little gnome
sunbeams on the grass
swing in the tree
a sprinkle of sugar
cheerful chickens
a tiny red boot
puppy in the sunshine
swirly lollipops
a lamb called pip
the giggly goose
silly sock puppets
buttons and bows
tickle the daisies
warm cup of milk
dreaming of clouds
the baker bunny
sing a little song
a yellow raincoat
splish splash puddle
hedgehog hugs
bear and honey
pony in the meadow
little green sprout
fireflies at dusk
a bed of violets
ant on a leaf
frog on a log
twinkle twinkle
bluebirds sing
a bowl of berries
snowflakes dancing
mitten for a snail
morning dew
chasing butterflies
ribbon in the breeze
tiny paws
the gentle giant
kite in the sky
piggy in the mud
paint a rainbow
waddle like a duck
a crown of clover
sleepy lambs
a happy little bee
the magic garden
the giggling gnome
a goldfish bowl
fuzzy caterpillar
peppermint tea
lilac and lavender
carrot for a bunny
a story at bedtime
fairy lanterns
a sunny day
seed in the soil
lots of lollipops
plant a flower
water the tulips
pick a peach
stir the soup
fluff the pillow
wave at the moon
tie a bow
four leaf clover
catch a snowflake
build a sandcastle
a rose for you
a cookie for me
puppy kisses
kitten naps
friends forever
best friends
a big warm hug
a surprise picnic
sweet strawberry jam
a pumpkin pie
toast with honey
a shiny new penny
a wishing well
a magic wand
a castle of cushions
the moon smiles
stars in a jar
cloud watching
a leaf boat
a mossy stone
a tiny teacup
walnut shells
a sleepy lion
a snail parade
umbrella for a frog
mole in a bowtie
gardens grow
sunshine and showers
a flutter of wings
rolling green hills
river picnic
muffins in the oven
a cheerful whistle
a tulip tea party
`);

/** Whimsical full sentences, 4-10 words. */
export const SENTENCES: string[] = lines(`
The snail wore a tiny hat.
Bumble the bee loves clover.
We planted a seed and it grew!
Can you see the rainbow?
The duck wore bright red boots.
A hedgehog napped under the leaves.
The moon is smiling tonight.
Please pass the strawberry jam.
Pip found a shiny acorn.
Tea with friends is the best.
The frog hopped onto a lily pad.
A butterfly landed on my nose!
Rain pitter-patters on the roof.
Let's go on a picnic today.
The bunny baked a carrot cake.
Look at the glittery dewdrops!
The robin sang a happy song.
A little mouse found a big cheese.
The sunflowers nod their golden heads.
Wiggle your toes in the soft grass.
The owl read a book by candlelight.
Would you like a cup of cocoa?
The kitten chased a fluffy cloud.
My umbrella is covered in daisies.
The baker made muffins for everyone.
Fireflies blinked like tiny stars.
A snail can carry its house along.
The goat wore a cozy woolly coat.
Clover and Pip built a leaf boat.
The wind whispered through the willows.
Can we plant tulips by the gate?
Every flower starts as a small seed.
The tortoise took a nice slow stroll.
A fairy sprinkled glitter on the roses.
The pony trotted through the meadow.
Hooray, the sun came out!
Grandma's garden smells like lavender.
Three ducklings followed their mother.
The brook giggled over the pebbles.
I found a four leaf clover!
The gnome tipped his pointy hat.
Marshmallow clouds floated across the sky.
The puppy splashed in every puddle.
Honey drips from the warm toast.
The teapot sang a cheerful tune.
Mossy stones sat beside the pond.
A ladybug rested on a green leaf.
Dandelion seeds drift on the breeze.
The lamb skipped up the hill.
She tied a ribbon around the basket.
The wizard made a lemon pudding.
Let's build a castle out of cushions.
The squirrel hid an acorn in a boot.
Sunbeams tickled the sleepy daisies.
The goose honked a friendly hello.
Do you like blueberries or raspberries?
A tiny elf swung from a vine.
Our scarecrow wears a cheery smile.
The bees hummed a sleepy lullaby.
Bake a pie for your best friend.
The turtle painted a sunny picture.
The moon tucked the garden into bed.
Strawberries taste sweet in the summer.
A pink balloon floated over the hedge.
The mole wore a very fancy bowtie.
It's a perfect day for kites!
Watch the snowflakes dance and spin.
The fox shared his berries with the birds.
Little seeds dream of big flowers.
The owl hooted a gentle goodnight.
May I have another scone, please?
Rosie planted peas beside the fence.
The mouse sipped tea from an acorn cup.
We sang songs under the apple tree.
The cat curled up in a basket of yarn.
The raindrops sparkled like little jewels.
A snail parade crossed the garden path.
Sprinkle some sugar on the cookies.
The wishing well glowed with golden light.
Teddy shared his picnic with the ducks.
The hens clucked happily in the sun.
A sleepy bear hugged his honey pot.
The hills were soft and green.
Whisper a wish to the dandelion.
Paint the fence a cheerful yellow.
The caterpillar munched on a leaf.
Willow wore her favourite red mittens.
How many petals does a daisy have?
The old oak tree gave a gentle wave.
The cherry blossoms drifted like pink snow.
My pocket is full of pebbles and shells.
The magic wand twinkled in the moonlight.
Finch built a cozy nest in the pear tree.
Let's tiptoe past the sleeping kitten.
A rainbow stretched over the whole valley.
The tulips opened up to greet the sun.
Bring a blanket and some warm cocoa.
The lighthouse glowed on the quiet shore.
Nutmeg the pony loves sweet apples.
The little boat bobbed on the pond.
Which flower do you like best?
The squirrels shared a basket of nuts.
Sunny the duck splashed in the puddle.
The baker bunny sold fresh bread.
The clouds looked like fluffy sheep.
The garden grows more beautiful each day.
We waved at the passing butterflies.
Can you hear the crickets singing?
She made a crown from clover flowers.
The tiny acorn became a giant oak.
Let's have a tea party in the garden!
Biscuit the puppy wagged his tail.
Daisies dance when the breeze blows.
The star winked from the night sky.
The ferns unrolled their curly green leaves.
A friendly giraffe nibbled the treetops.
Toby tossed a pebble into the pond.
Lemonade tastes best on a sunny porch.
A butterfly is a flower with wings.
Poppy hung her wet boots by the door.
The lamb napped on a pillow of clouds.
My snail friend is very polite.
The tea was warm and the cake was sweet.
Mabel found a feather by the brook.
The elves baked gingerbread under the oak.
Spring brings tulips, daffodils, and bluebells.
Tell me a story about a sleepy dragonfly.
The kind gardener watered every seedling.
Pudding the pony wore a flower crown.
Hold my hand and let's skip!
Goldfish swim in slow, shiny circles.
The cheerful chicks peeped for breakfast.
Look, the bluebird built a tiny home!
Jam and cream make the scone perfect.
The snow fell softly on the garden gate.
Marigold wrapped her scarf around a snowman.
The ducks waddled in a neat little line.
Is the kettle singing yet?
A kind word is like warm sunshine.
We tucked the seeds into the soft soil.
The wind chimes tinkled a merry tune.
The rabbit hopped over the moonlit hill.
Everyone is welcome at the garden party.
The hedgehog rolled into a cozy ball.
Nina and Milo watched the clouds drift by.
The snail polished his tiny shell.
Did you see the bees dancing?
Hazel hummed while she watered the ferns.
A cozy quilt covered the sleepy puppy.
The butterflies painted the sky with color.
Let's hop along the stepping stones!
Tilly poured tea for her teddy bear.
The brave little seed pushed through the soil.
Maple leaves float down like tiny boats.
What a lovely morning for a stroll!
`);
