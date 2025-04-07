use aztec::macros::aztec;

// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3


#[aztec]
pub contract WarpToadCore {
    use std::hash::poseidon;
    use aztec::macros::{functions::{initializer, public}, storage::storage}; 
    use aztec::prelude::{PublicMutable,PublicImmutable, Map}; 

    #[storage]
    struct Storage<Context> {
        maxTreeDepth: PublicImmutable<u32, Context>,
    
        localRoot: PublicMutable<Field, Context>,
        lastLeafIndex: PublicMutable<u128, Context>,

        leaves: Map<Field, PublicMutable<Field, Context>, Context>,             // mapping(index -> hash)          
        lastSubtrees:  Map<u32, PublicMutable<Field, Context>, Context>,        // mapping(index -> subTreeHash)     
        number_of_leaves: PublicMutable<Field, Context>,
    }

    fn default_zeros(index: u32) -> pub Field {
        let zeros = [
            0,
            14744269619966411208579211824598458697587494354926760081771325075741142829156,
            7423237065226347324353380772367382631490014989348495481811164164159255474657,
            11286972368698509976183087595462810875513684078608517520839298933882497716792,
            3607627140608796879659380071776844901612302623152076817094415224584923813162,
            19712377064642672829441595136074946683621277828620209496774504837737984048981,
            20775607673010627194014556968476266066927294572720319469184847051418138353016,
            3396914609616007258851405644437304192397291162432396347162513310381425243293,
            21551820661461729022865262380882070649935529853313286572328683688269863701601,
            6573136701248752079028194407151022595060682063033565181951145966236778420039,
            12413880268183407374852357075976609371175688755676981206018884971008854919922,
            14271763308400718165336499097156975241954733520325982997864342600795471836726,
            20066985985293572387227381049700832219069292839614107140851619262827735677018,
            9394776414966240069580838672673694685292165040808226440647796406499139370960,
            11331146992410411304059858900317123658895005918277453009197229807340014528524,
            15819538789928229930262697811477882737253464456578333862691129291651619515538,
            19217088683336594659449020493828377907203207941212636669271704950158751593251,
            21035245323335827719745544373081896983162834604456827698288649288827293579666,
            6939770416153240137322503476966641397417391950902474480970945462551409848591,
            10941962436777715901943463195175331263348098796018438960955633645115732864202,
            15019797232609675441998260052101280400536945603062888308240081994073687793470,
            11702828337982203149177882813338547876343922920234831094975924378932809409969,
            11217067736778784455593535811108456786943573747466706329920902520905755780395,
            16072238744996205792852194127671441602062027943016727953216607508365787157389,
            17681057402012993898104192736393849603097507831571622013521167331642182653248,
            21694045479371014653083846597424257852691458318143380497809004364947786214945,
            8163447297445169709687354538480474434591144168767135863541048304198280615192,
            14081762237856300239452543304351251708585712948734528663957353575674639038357,
            16619959921569409661790279042024627172199214148318086837362003702249041851090,
            7022159125197495734384997711896547675021391130223237843255817587255104160365,
            4114686047564160449611603615418567457008101555090703535405891656262658644463,
            12549363297364877722388257367377629555213421373705596078299904496781819142130,
            21443572485391568159800782191812935835534334817699172242223315142338162256601,
        ];
        zeros[index]
    }

    // constructor bassically
    #[initializer]
    #[public]
    // We can name our initializer anything we want as long as it's marked as aztec(initializer)
    fn initialize(_maxTreeDepth: u32) {
        storage.maxTreeDepth.initialize(_maxTreeDepth);
        //init_zeros(_maxTreeDepth);

        // cant do this in a function it will fail. Its prob because zeros is immutable and can only be initialized here

        for index in 0 .. _maxTreeDepth  {
            storage.lastSubtrees.at(index).write(default_zeros(index));
        }

        storage.localRoot.write(default_zeros(_maxTreeDepth));
    }   

    unconstrained fn get_root() -> pub Field {
       storage.localRoot.read()
    }


    // we need to push the commitments to aztecs own commitment tree.
    // we're at the gas limit at depth 4. absolute cringe!
    // so we dont have to fuck with enque to public which leaks information
    // also saves on cost vs making incontract merkle tree
    // L1 contract would just get the aztec commitment root somehow and treat that as a localRoot
    #[public] //@TODO make sure only this contract can call this
    fn _insertLeaf(_leaf: Field) {
        // based of: https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/309b8d8d7d4f553ef44e3aa672040a3698e5179c/packages/imt/contracts/InternalBinaryIMT.sol#L142
        let depth: u32 = storage.maxTreeDepth.read();

        let mut index:u128 = storage.lastLeafIndex.read();
        storage.lastLeafIndex.write(index+1);
        storage.leaves.at(index as Field).write(_leaf);

        let mut hash: Field = _leaf; 

        for i in 0..depth {
            if(index%2==0) {
                hash = poseidon::bn254::hash_2([hash,default_zeros(i)]);
                storage.lastSubtrees.at(i+1).write(hash);
            } else {
                hash = poseidon::bn254::hash_2([storage.lastSubtrees.at(i).read(), hash]);
            }

            index /= 2; 
        };

        storage.localRoot.write(hash);
    }

    #[public] //literally cant do more than 4 hashes
    fn hash_n_times(n:u32) {
        // based of: https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/309b8d8d7d4f553ef44e3aa672040a3698e5179c/packages/imt/contracts/InternalBinaryIMT.sol#L142
        for index in 0 .. n {
            poseidon::bn254::hash_2([0, 0x1234]);
        }
    }
}
