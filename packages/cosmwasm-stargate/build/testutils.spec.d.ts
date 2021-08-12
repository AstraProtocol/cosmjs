import { AminoSignResponse, Secp256k1HdWallet, Secp256k1HdWalletOptions, StdSignDoc } from "@cosmjs/amino";
import { DirectSecp256k1HdWallet, DirectSecp256k1HdWalletOptions, DirectSignResponse } from "@cosmjs/proto-signing";
import { AuthExtension, BankExtension, GasPrice, QueryClient } from "@cosmjs/stargate";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { WasmExtension } from "./queries";
import { SigningCosmWasmClientOptions } from "./signingcosmwasmclient";
export declare const defaultGasPrice: GasPrice;
export declare const defaultSendFee: import("@cosmjs/amino").StdFee;
export declare const defaultUploadFee: import("@cosmjs/amino").StdFee;
export declare const defaultInstantiateFee: import("@cosmjs/amino").StdFee;
export declare const defaultExecuteFee: import("@cosmjs/amino").StdFee;
export declare const defaultMigrateFee: import("@cosmjs/amino").StdFee;
export declare const defaultUpdateAdminFee: import("@cosmjs/amino").StdFee;
export declare const defaultClearAdminFee: import("@cosmjs/amino").StdFee;
/** An internal testing type. SigningCosmWasmClient has a similar but different interface */
export interface ContractUploadInstructions {
    /** The wasm bytecode */
    readonly data: Uint8Array;
}
export declare const wasmd: {
    blockTime: number;
    chainId: string;
    endpoint: string;
    prefix: string;
    validator: {
        address: string;
    };
};
/** Setting to speed up testing */
export declare const defaultSigningClientOptions: SigningCosmWasmClientOptions;
export declare function getHackatom(): ContractUploadInstructions;
export declare function makeRandomAddress(): string;
export declare const tendermintIdMatcher: RegExp;
/** @see https://rgxdb.com/r/1NUN74O6 */
export declare const base64Matcher: RegExp;
export declare const bech32AddressMatcher: RegExp;
export declare const alice: {
    mnemonic: string;
    pubkey0: {
        type: string;
        value: string;
    };
    address0: string;
    address1: string;
    address2: string;
    address3: string;
    address4: string;
};
/** Unused account */
export declare const unused: {
    pubkey: {
        type: string;
        value: string;
    };
    address: string;
    accountNumber: number;
    sequence: number;
};
export declare const validator: {
    /**
     * delegator_address from /cosmos.staking.v1beta1.MsgCreateValidator in scripts/wasmd/template/.wasmd/config/genesis.json
     *
     * `jq ".app_state.genutil.gen_txs[0].body.messages[0].delegator_address" scripts/wasmd/template/.wasmd/config/genesis.json`
     */
    delegatorAddress: string;
    /**
     * validator_address from /cosmos.staking.v1beta1.MsgCreateValidator in scripts/wasmd/template/.wasmd/config/genesis.json
     *
     * `jq ".app_state.genutil.gen_txs[0].body.messages[0].validator_address" scripts/wasmd/template/.wasmd/config/genesis.json`
     */
    validatorAddress: string;
    accountNumber: number;
    sequence: number;
};
/** Deployed as part of scripts/wasmd/init.sh */
export declare const deployedHackatom: {
    codeId: number;
    checksum: string;
    instances: {
        beneficiary: string;
        address: string;
        label: string;
    }[];
};
/** Deployed as part of scripts/wasmd/init.sh */
export declare const deployedIbcReflect: {
    codeId: number;
    instances: {
        address: string;
        ibcPortId: string;
    }[];
};
/** Deployed as part of scripts/wasmd/init.sh */
export declare const deployedCw3: {
    codeId: number;
    instances: string[];
};
/** Deployed as part of scripts/wasmd/init.sh */
export declare const deployedCw1: {
    codeId: number;
    instances: string[];
};
export declare function wasmdEnabled(): boolean;
export declare function pendingWithoutWasmd(): void;
export declare function cw3Enabled(): boolean;
export declare function pendingWithoutCw3(): void;
export declare function cw1Enabled(): boolean;
export declare function pendingWithoutCw1(): void;
/** Returns first element. Throws if array has a different length than 1. */
export declare function fromOneElementArray<T>(elements: ArrayLike<T>): T;
export declare function makeWasmClient(endpoint: string): Promise<QueryClient & AuthExtension & BankExtension & WasmExtension>;
/**
 * A class for testing clients using an Amino signer which modifies the transaction it receives before signing
 */
export declare class ModifyingSecp256k1HdWallet extends Secp256k1HdWallet {
    static fromMnemonic(mnemonic: string, options?: Partial<Secp256k1HdWalletOptions>): Promise<ModifyingSecp256k1HdWallet>;
    signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse>;
}
/**
 * A class for testing clients using a direct signer which modifies the transaction it receives before signing
 */
export declare class ModifyingDirectSecp256k1HdWallet extends DirectSecp256k1HdWallet {
    static fromMnemonic(mnemonic: string, options?: Partial<DirectSecp256k1HdWalletOptions>): Promise<DirectSecp256k1HdWallet>;
    signDirect(address: string, signDoc: SignDoc): Promise<DirectSignResponse>;
}