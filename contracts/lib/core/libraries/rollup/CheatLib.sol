// SPDX-License-Identifier: Apache-2.0
// Copyright 2024 Aztec Labs.
pragma solidity >=0.8.27;

import {CheatDepositArgs} from "./lib/interfaces/IRollup.sol";
import {IVerifier} from "./lib/interfaces/IVerifier.sol";
import {STFLib} from "./lib/libraries/rollup/STFLib.sol";
import {StakingLib} from "./lib/libraries/staking/StakingLib.sol";

/**
 * @title   CheatLib
 * @author  Aztec Labs
 * @notice  A library of cheat codes for the RollupCore
 *          Should be nuked from orbit.
 */
library CheatLib {
    function cheat__InitialiseValidatorSet(
        CheatDepositArgs[] memory _args
    ) internal {
        for (uint256 i = 0; i < _args.length; i++) {
            StakingLib.deposit(
                _args[i].attester,
                _args[i].proposer,
                _args[i].withdrawer,
                _args[i].amount
            );
        }
    }

    function setEpochVerifier(address _verifier) internal {
        STFLib.getStorage().config.epochProofVerifier = IVerifier(_verifier);
    }

    function setVkTreeRoot(bytes32 _vkTreeRoot) internal {
        STFLib.getStorage().config.vkTreeRoot = _vkTreeRoot;
    }

    function setProtocolContractTreeRoot(
        bytes32 _protocolContractTreeRoot
    ) internal {
        STFLib
            .getStorage()
            .config
            .protocolContractTreeRoot = _protocolContractTreeRoot;
    }
}
