//use dep::std::hash::poseidon;
use dep::poseidon::poseidon;
use constants::{
    AZTEC_TREE_DEPTH,
    EVM_TREE_DEPTH,
    GIGA_TREE_DEPTH

};

use merkle_verify::{aztec_merkle_verify, evm_merkle_verify,Aztec_merkle_data,Evm_merkle_data};


//     commitmentHash (hashed onchain on deposit)
//              /                       \
//     pre_commitment_hash          amount (public)
//  (hashed by user, private)
//          |
//     nullifierPreimg, secret, chain_id
fn hash_commitment(nullifier_preimage: Field, secret: Field, chain_id: Field, amount: Field) -> (Field,Field) {
    let computed_nullifier_hash: Field = poseidon::bn254::hash_1([nullifier_preimage]);
    let pre_commitment_hash: Field =  poseidon::bn254::hash_3([nullifier_preimage,secret, chain_id]);
    let commitment: Field = poseidon::bn254::hash_2([pre_commitment_hash,amount]);
    (commitment,computed_nullifier_hash)
}

fn main(
    // ----- public inputs -----
    nullifier: pub Field,
    chain_id: pub Field,
    amount: pub Field,
    giga_root: pub Field,
    destination_local_root: pub Field,

    // fee_factor is what the contract multiplies by the (baseFee+priorityFee) and pays that to relayer. 
    // So calculating it would be fee_factor = gasCost * wrptdTOKENPriceWei * relayerBonusFactor
    // relayerBonusFactor eg: 1.10 <= relayer earns 10% on top of the gas fees
    
    fee_factor: pub Field, 
    priority_fee: pub Field,
    max_fee: pub Field,
    relayer_address: pub Field,                     // eth address left padded zeros
    recipient_address: pub Field,                   // eth address left padded zeros

    // ----- private inputs -----
    origin_local_root: Field,
    is_from_aztec: bool,
    nullifier_preimage: Field,
    secret: Field,
    aztec_merkle_data: Aztec_merkle_data<AZTEC_TREE_DEPTH>,
    evm_merkle_data: Evm_merkle_data<EVM_TREE_DEPTH>, // TODO rename
    giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
)
{   
    // there is no syntax for amount >= max_fee. Thats why it looks weird
    assert(!amount.lt(max_fee), "max_fee higher than amount");
    
    // idk if we need to do this but its stops the compiler warnings
    assert(fee_factor != 1, "fee factor cant be 1"); // we use 0 to detect if user doesn't want to pay the relayer
    assert(relayer_address != 0, "relayer_address cant be 0");
    assert(recipient_address != 0, "recipient_address cant be 0");
    assert(priority_fee != 0, "priority_fee cant be 0");

    // verify origin_local_root is valid
    if (destination_local_root == origin_local_root) {
        // Is the same as origin_local_root? cool we shouldn't do anything. destination_local_root is a public input so its safe  :)
        // Besides, by not checking, it allows us to use a local_root that has never been used to make a giga_root yet!
    } else {
        // origin_local_root should be in the giga_root!
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
    }

    // verify commitment is part of destination_local_root
    let (commitment, _nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, amount);
    assert(_nullifier == nullifier, "nullifier doesn't match inputs");
    
    // aztecs tree is different from ours because we haven't come around to making a poseidon2 merkle tree in solidity yet.
    // besides poseidon2 might cost more gas? 
    if (is_from_aztec) {
        aztec_merkle_verify(origin_local_root, commitment, aztec_merkle_data);
    } else {
        evm_merkle_verify(origin_local_root, commitment, evm_merkle_data);
    }
}

#[test]
fn test_aztec_to_L1_main() {
    let nullifier:              Field = 0x187ba16490abbc9983dd173e0d491aa5cb45d3aa1c2976716dec69a8680828b8;
    let chain_id:               Field = 0x7a69;
    let amount:                 Field = 0x4563918244f40000;
    let giga_root:              Field = 0x00;
    let destination_local_root: Field = 0x2f68a1c58e257e42a17a6c61dff5551ed560b9922ab119d5ac8e184c9734ead9;
    let fee_factor:             Field = 0x3a143d8a;
    let priority_fee:           Field = 0x05f5e100;
    let max_fee:                Field = 0x4563918244f40000;
    let relayer_address:        Field = 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc;            
    let recipient_address:      Field = 0x70997970c51812dc3a010c7d01b50e0d17dc79c8;          

    // ----- private inputs -----
    let origin_local_root:      Field = 0x0e81a5edae09b39749a81a7114d8eeff78ed72b85e7b2154e8d562b8ca9482f8;
    let is_from_aztec:          bool  = true;
    let nullifier_preimage:     Field = 0x10e1;
    let secret:                 Field = 0x04d2;
    let aztec_merkle_data: Aztec_merkle_data<40> = Aztec_merkle_data {
        leaf_index:                 0x1201,
        hash_path:                  [0x1b65578b174e073ba50379e568249405bd9c059b4ccc62932880d8469e47cdcc,0x0b63a53787021a4a962a452c2921b3663aff1ffd8d5510540f8e659e782956f1,0x0e34ac2c09f45a503d2908bcb12f1cbae5fa4065759c88d501c097506a8b2290,0x21f9172d72fdcdafc312eee05cf5092980dda821da5b760a9fb8dbdf607c8a20,0x2373ea368857ec7af97e7b470d705848e2bf93ed7bef142a490f2119bcf82d8e,0x120157cfaaa49ce3da30f8b47879114977c24b266d58b0ac18b325d878aafddf,0x01c28fe1059ae0237b72334700697bdf465e03df03986fe05200cadeda66bd76,0x2d78ed82f93b61ba718b17c2dfe5b52375b4d37cbbed6f1fc98b47614b0cf21b,0x067243231eddf4222f3911defbba7705aff06ed45960b27f6f91319196ef97e1,0x1442792d21737d775dfb4591924db51e6994afef79ead4d19e0804ba8e1ed96a,0x2a775ea761d20435b31fa2c33ff07663e24542ffb9e7b293dfce3042eb104686,0x0f320b0703439a8114f81593de99cd0b8f3b9bf854601abb5b2ea0e8a3dda4a7,0x0cebcea7ba73afc22c9985561d3bcdd93a72a64af9696bd114836d88d23118c9,0x1c4954081e324939350febc2b918a293ebcdaead01be95ec02fcbe8d2c1635d1,0x0197f2171ef99c2d053ee1fb5ff5ab288d56b9b41b4716c9214a4d97facc4c4a,0x2b9cdd484c5ba1e4d6efcc3f18734b5ac4c4a0b9102e2aeb48521a661d3feee9,0x14f44d672eb357739e42463497f9fdac46623af863eea4d947ca00a497dcdeb3,0x071d7627ae3b2eabda8a810227bf04206370ac78dbf6c372380182dbd3711fe3,0x2fdc08d9fe075ac58cb8c00f98697861a13b3ab6f9d41a4e768f75e477475bf5,0x20165fe405652104dceaeeca92950aa5adc571b8cafe192878cba58ff1be49c5,0x1c8c3ca0b3a3d75850fcd4dc7bf1e3445cd0cfff3ca510630fd90b47e8a24755,0x1f0c1a8fb16b0d2ac9a146d7ae20d8d179695a92a79ed66fc45d9da4532459b3,0x038146ec5a2573e1c30d2fb32c66c8440f426fbd108082df41c7bebd1d521c30,0x17d3d12b17fe762de4b835b2180b012e808816a7f2ff69ecb9d65188235d8fd4,0x0e1a6b7d63a6e5a9e54e8f391dd4e9d49cdfedcbc87f02cd34d4641d2eb30491,0x09244eec34977ff795fc41036996ce974136377f521ac8eb9e04642d204783d2,0x1646d6f544ec36df9dc41f778a7ef1690a53c730b501471b6acd202194a7e8e9,0x064769603ba3f6c41f664d266ecb9a3a0f6567cd3e48b40f34d4894ee4c361b3,0x1595bb3cd19f84619dc2e368175a88d8627a7439eda9397202cdb1167531fd3f,0x2a529be462b81ca30265b558763b1498289c9d88277ab14f0838cb1fce4b472c,0x0c08da612363088ad0bbc78abd233e8ace4c05a56fdabdd5e5e9b05e428bdaee,0x14748d0241710ef47f54b931ac5a58082b1d56b0f0c30d55fb71a6e8c9a6be14,0x0b59baa35b9dc267744f0ccb4e3b0255c1fc512460d91130c6bc19fb2668568d,0x2c45bb0c3d5bc1dc98e0baef09ff46d18c1a451e724f41c2b675549bb5c80e59,0x121468e6710bf1ffec6d0f26743afe6f88ef55dab40b83ca0a39bc44b196374c,0x2042c32c823a7440ceb6c342f9125f1fe426b02c527cd8fb28c85d02b705e759,0x0d582c10ff8115413aa5b70564fdd2f3cefe1f33a1e43a47bc495081e91e73e5,0x0f55a0d491a9da093eb999fa0dffaf904620cbc78d07e63c6f795c5c7512b523,0x21849764e1aa64b83a69e39d27eedaec2a8f97066e5ddb74634ffdb11388dd9a,0x2e33ee2008411c04b99c24b313513d097a0d21a5040b6193d1f978b8226892d6],
        leaf_nonce:                 0x0a55996a37573d8c0293e8829d5e0f6eb151899afb34c74e6b52317295a8efab,
        contract_address:           0x1e89c33dc4382f1eb3ede39cdbfb48e3e6998c446c3ea5b5abf77c90d1a46eef,
    };
    let evm_merkle_data: Evm_merkle_data<32> = Evm_merkle_data {
        leaf_index:                 0x00,
        hash_path:                  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    };
    let giga_merkle_data: Evm_merkle_data<5> = Evm_merkle_data {
        leaf_index:                 0x00,
        hash_path:                  [0x00,0x00,0x00,0x00,0x00],
    };
    main(
        nullifier,
        chain_id,
        amount,
        giga_root,
        destination_local_root,
        fee_factor, 
        priority_fee,
        max_fee,
        relayer_address,              
        recipient_address,             
        origin_local_root, 
        is_from_aztec,
        nullifier_preimage, 
        secret,
        aztec_merkle_data,
        evm_merkle_data,
        giga_merkle_data,
    )
}


#[test]
fn test_L1_to_L1_main() {
    let nullifier:              Field = 0x018440d48ca505f3a5e59aeea91b38cb80f2df67f7561736429432bf19ae288d;
    let chain_id:               Field = 0x7a69;
    let amount:                 Field = 0x02b5e3af16b1880000;
    let giga_root:              Field = 0x00;
    let destination_local_root: Field = 0x2b53012945fecde960ebed575db18d263b31807cb8d33610982070a1d19aef6e;
    let fee_factor:             Field = 0x3a143d8a;
    let priority_fee:           Field = 0x05f5e100;
    let max_fee:                Field = 0x4563918244f40000;
    let relayer_address:        Field = 0x5678000000000000000000000000000000009123;            
    let recipient_address:      Field = 0x1234000000000000000000000000000000005678;          

    // ----- private inputs -----
    let origin_local_root:      Field = 0x2b53012945fecde960ebed575db18d263b31807cb8d33610982070a1d19aef6e;
    let is_from_aztec:          bool  = false;
    let nullifier_preimage:     Field = 0x078d38cf14c859975ddeb3d36af421a34c08687cde97646e70609f1cefee23d5;
    let secret:                 Field = 0x17c90f6d16f4743fd54c604cfeb4b821dd393e73c98f2459f50f5a8ab8ff4a36;
    let aztec_merkle_data: Aztec_merkle_data<40> = Aztec_merkle_data {
        leaf_index:                 0x00,
        hash_path:                  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
        leaf_nonce:                 0x00,
        contract_address:           0x00,
    };
    let evm_merkle_data: Evm_merkle_data<32> = Evm_merkle_data {
        leaf_index:                 0x00,
        hash_path:                  [0x288af087319ba037f7342ec4be5fa8ab1281e70fa399a128d638dbdd779cc838,0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1,0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238,0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a,0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55,0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78,0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d,0x2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc61,0x0e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd747,0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2,0x1f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d7636,0x2c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a,0x14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0,0x190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c,0x22f98aa9ce704152ac17354914ad73ed1167ae6596af510aa5b3649325e06c92,0x2a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba7323,0x2e8186e558698ec1c67af9c14d463ffc470043c9c2988b954d75dd643f36b992,0x0f57c5571e9a4eab49e2c8cf050dae948aef6ead647392273546249d1c1ff10f,0x1830ee67b5fb554ad5f63d4388800e1cfe78e310697d46e43c9ce36134f72cca,0x2134e76ac5d21aab186c2be1dd8f84ee880a1e46eaf712f9d371b6df22191f3e,0x19df90ec844ebc4ffeebd866f33859b0c051d8c958ee3aa88f8f8df3db91a5b1,0x18cca2a66b5c0787981e69aefd84852d74af0e93ef4912b4648c05f722efe52b,0x2388909415230d1b4d1304d2d54f473a628338f2efad83fadf05644549d2538d,0x27171fb4a97b6cc0e9e8f543b5294de866a2af2c9c8d0b1d96e673e4529ed540,0x2ff6650540f629fd5711a0bc74fc0d28dcb230b9392583e5f8d59696dde6ae21,0x120c58f143d491e95902f7f5277778a2e0ad5168f6add75669932630ce611518,0x1f21feb70d3f21b07bf853d5e5db03071ec495a0a565a21da2d665d279483795,0x24be905fa71335e14c638cc0f66a8623a826e768068a9e968bb1a1dde18a72d2,0x0f8666b62ed17491c50ceadead57d4cd597ef3821d65c328744c74e553dac26d,0x0918d46bf52d98b034413f4a1a1c41594e7a7a3f6ae08cb43d1a2a230e1959ef,0x1bbeb01b4c479ecde76917645e404dfa2e26f90d0afc5a65128513ad375c5ff2],
    };
    let giga_merkle_data: Evm_merkle_data<5> = Evm_merkle_data {
        leaf_index:                 0x00,
        hash_path:                  [0x00,0x00,0x00,0x00,0x00],
    };
    main(
        nullifier,
        chain_id,
        amount,
        giga_root,
        destination_local_root,
        fee_factor, 
        priority_fee,
        max_fee,
        relayer_address,              
        recipient_address,             
        origin_local_root, 
        is_from_aztec,
        nullifier_preimage, 
        secret,
        aztec_merkle_data,
        evm_merkle_data,
        giga_merkle_data,
    )
}