// SPDX-License-Identifier: Apache-2.0
// Copyright 2024 Aztec Labs.
pragma solidity >=0.8.27;

import {IPayload} from "./IPayload.sol";

interface ISlasher {
    function slash(IPayload _payload) external returns (bool);
}
