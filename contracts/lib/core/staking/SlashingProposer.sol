// SPDX-License-Identifier: Apache-2.0
// Copyright 2024 Aztec Labs.
pragma solidity >=0.8.27;

import {ISlasher} from "./lib/interfaces/ISlasher.sol";
import {IGovernanceProposer} from "./lib/governance/interfaces/IGovernanceProposer.sol";
import {IPayload} from "./lib/governance/interfaces/IPayload.sol";
import {EmpireBase} from "./lib/governance/proposer/EmpireBase.sol";

/**
 * @notice  A SlashingProposer implementation following the empire model
 */
contract SlashingProposer is IGovernanceProposer, EmpireBase {
    address public immutable INSTANCE;
    ISlasher public immutable SLASHER;

    constructor(
        address _instance,
        ISlasher _slasher,
        uint256 _slashingQuorum,
        uint256 _roundSize
    ) EmpireBase(_slashingQuorum, _roundSize) {
        INSTANCE = _instance;
        SLASHER = _slasher;
    }

    function getExecutor()
        public
        view
        override(EmpireBase, IGovernanceProposer)
        returns (address)
    {
        return address(SLASHER);
    }

    function getInstance()
        public
        view
        override(EmpireBase, IGovernanceProposer)
        returns (address)
    {
        return INSTANCE;
    }

    function _execute(
        IPayload _proposal
    ) internal override(EmpireBase) returns (bool) {
        return SLASHER.slash(_proposal);
    }
}
