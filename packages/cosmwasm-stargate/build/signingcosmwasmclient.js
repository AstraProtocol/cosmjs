"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SigningCosmWasmClient = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const amino_1 = require("@cosmjs/amino");
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
const math_1 = require("@cosmjs/math");
const proto_signing_1 = require("@cosmjs/proto-signing");
const stargate_1 = require("@cosmjs/stargate");
const tendermint_rpc_1 = require("@cosmjs/tendermint-rpc");
const utils_1 = require("@cosmjs/utils");
const tx_1 = require("cosmjs-types/cosmos/distribution/v1beta1/tx");
const tx_2 = require("cosmjs-types/cosmos/staking/v1beta1/tx");
const signing_1 = require("cosmjs-types/cosmos/tx/signing/v1beta1/signing");
const tx_3 = require("cosmjs-types/cosmos/tx/v1beta1/tx");
const tx_4 = require("cosmjs-types/cosmwasm/wasm/v1/tx");
const long_1 = __importDefault(require("long"));
const pako_1 = __importDefault(require("pako"));
const aminotypes_1 = require("./aminotypes");
const cosmwasmclient_1 = require("./cosmwasmclient");
function createBroadcastTxErrorMessage(result) {
    return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}
function createDefaultRegistry() {
    return new proto_signing_1.Registry([
        ...stargate_1.defaultRegistryTypes,
        ["/cosmwasm.wasm.v1.MsgClearAdmin", tx_4.MsgClearAdmin],
        ["/cosmwasm.wasm.v1.MsgExecuteContract", tx_4.MsgExecuteContract],
        ["/cosmwasm.wasm.v1.MsgMigrateContract", tx_4.MsgMigrateContract],
        ["/cosmwasm.wasm.v1.MsgStoreCode", tx_4.MsgStoreCode],
        ["/cosmwasm.wasm.v1.MsgInstantiateContract", tx_4.MsgInstantiateContract],
        ["/cosmwasm.wasm.v1.MsgUpdateAdmin", tx_4.MsgUpdateAdmin],
    ]);
}
class SigningCosmWasmClient extends cosmwasmclient_1.CosmWasmClient {
    constructor(tmClient, signer, options) {
        super(tmClient);
        const { registry = createDefaultRegistry(), aminoTypes = new stargate_1.AminoTypes({ additions: aminotypes_1.cosmWasmTypes, prefix: options.prefix }), } = options;
        this.registry = registry;
        this.aminoTypes = aminoTypes;
        this.signer = signer;
        this.broadcastTimeoutMs = options.broadcastTimeoutMs;
        this.broadcastPollIntervalMs = options.broadcastPollIntervalMs;
    }
    static async connectWithSigner(endpoint, signer, options = {}) {
        const tmClient = await tendermint_rpc_1.Tendermint34Client.connect(endpoint);
        return new SigningCosmWasmClient(tmClient, signer, options);
    }
    /**
     * Creates a client in offline mode.
     *
     * This should only be used in niche cases where you know exactly what you're doing,
     * e.g. when building an offline signing application.
     *
     * When you try to use online functionality with such a signer, an
     * exception will be raised.
     */
    static async offline(signer, options = {}) {
        return new SigningCosmWasmClient(undefined, signer, options);
    }
    /** Uploads code and returns a receipt, including the code ID */
    async upload(senderAddress, wasmCode, fee, memo = "") {
        const compressed = pako_1.default.gzip(wasmCode, { level: 9 });
        const storeCodeMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode",
            value: tx_4.MsgStoreCode.fromPartial({
                sender: senderAddress,
                wasmByteCode: compressed,
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [storeCodeMsg], fee, memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        const parsedLogs = stargate_1.logs.parseRawLog(result.rawLog);
        const codeIdAttr = stargate_1.logs.findAttribute(parsedLogs, "store_code", "code_id");
        return {
            originalSize: wasmCode.length,
            originalChecksum: encoding_1.toHex(crypto_1.sha256(wasmCode)),
            compressedSize: compressed.length,
            compressedChecksum: encoding_1.toHex(crypto_1.sha256(compressed)),
            codeId: Number.parseInt(codeIdAttr.value, 10),
            logs: parsedLogs,
            transactionHash: result.transactionHash,
        };
    }
    async instantiate(senderAddress, codeId, msg, label, fee, options = {}) {
        const instantiateContractMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
            value: tx_4.MsgInstantiateContract.fromPartial({
                sender: senderAddress,
                codeId: long_1.default.fromString(new math_1.Uint53(codeId).toString()),
                label: label,
                msg: encoding_1.toUtf8(JSON.stringify(msg)),
                funds: [...(options.funds || [])],
                admin: options.admin,
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [instantiateContractMsg], fee, options.memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        const parsedLogs = stargate_1.logs.parseRawLog(result.rawLog);
        const contractAddressAttr = stargate_1.logs.findAttribute(parsedLogs, "instantiate", "_contract_address");
        return {
            contractAddress: contractAddressAttr.value,
            logs: parsedLogs,
            transactionHash: result.transactionHash,
        };
    }
    async updateAdmin(senderAddress, contractAddress, newAdmin, fee, memo = "") {
        const updateAdminMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgUpdateAdmin",
            value: tx_4.MsgUpdateAdmin.fromPartial({
                sender: senderAddress,
                contract: contractAddress,
                newAdmin: newAdmin,
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [updateAdminMsg], fee, memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        return {
            logs: stargate_1.logs.parseRawLog(result.rawLog),
            transactionHash: result.transactionHash,
        };
    }
    async clearAdmin(senderAddress, contractAddress, fee, memo = "") {
        const clearAdminMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgClearAdmin",
            value: tx_4.MsgClearAdmin.fromPartial({
                sender: senderAddress,
                contract: contractAddress,
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [clearAdminMsg], fee, memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        return {
            logs: stargate_1.logs.parseRawLog(result.rawLog),
            transactionHash: result.transactionHash,
        };
    }
    async migrate(senderAddress, contractAddress, codeId, migrateMsg, fee, memo = "") {
        const migrateContractMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
            value: tx_4.MsgMigrateContract.fromPartial({
                sender: senderAddress,
                contract: contractAddress,
                codeId: long_1.default.fromString(new math_1.Uint53(codeId).toString()),
                msg: encoding_1.toUtf8(JSON.stringify(migrateMsg)),
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [migrateContractMsg], fee, memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        return {
            logs: stargate_1.logs.parseRawLog(result.rawLog),
            transactionHash: result.transactionHash,
        };
    }
    async execute(senderAddress, contractAddress, msg, fee, memo = "", funds) {
        const executeContractMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
            value: tx_4.MsgExecuteContract.fromPartial({
                sender: senderAddress,
                contract: contractAddress,
                msg: encoding_1.toUtf8(JSON.stringify(msg)),
                funds: [...(funds || [])],
            }),
        };
        const result = await this.signAndBroadcast(senderAddress, [executeContractMsg], fee, memo);
        if (stargate_1.isBroadcastTxFailure(result)) {
            throw new Error(createBroadcastTxErrorMessage(result));
        }
        return {
            logs: stargate_1.logs.parseRawLog(result.rawLog),
            transactionHash: result.transactionHash,
        };
    }
    async sendTokens(senderAddress, recipientAddress, amount, fee, memo = "") {
        const sendMsg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: senderAddress,
                toAddress: recipientAddress,
                amount: [...amount],
            },
        };
        return this.signAndBroadcast(senderAddress, [sendMsg], fee, memo);
    }
    async delegateTokens(delegatorAddress, validatorAddress, amount, fee, memo = "") {
        const delegateMsg = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: tx_2.MsgDelegate.fromPartial({ delegatorAddress: delegatorAddress, validatorAddress, amount }),
        };
        return this.signAndBroadcast(delegatorAddress, [delegateMsg], fee, memo);
    }
    async undelegateTokens(delegatorAddress, validatorAddress, amount, fee, memo = "") {
        const undelegateMsg = {
            typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
            value: tx_2.MsgUndelegate.fromPartial({ delegatorAddress: delegatorAddress, validatorAddress, amount }),
        };
        return this.signAndBroadcast(delegatorAddress, [undelegateMsg], fee, memo);
    }
    async withdrawRewards(delegatorAddress, validatorAddress, fee, memo = "") {
        const withdrawDelegatorRewardMsg = {
            typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
            value: tx_1.MsgWithdrawDelegatorReward.fromPartial({ delegatorAddress: delegatorAddress, validatorAddress }),
        };
        return this.signAndBroadcast(delegatorAddress, [withdrawDelegatorRewardMsg], fee, memo);
    }
    /**
     * Creates a transaction with the given messages, fee and memo. Then signs and broadcasts the transaction.
     *
     * @param signerAddress The address that will sign transactions using this instance. The signer must be able to sign with this address.
     * @param messages
     * @param fee
     * @param memo
     */
    async signAndBroadcast(signerAddress, messages, fee, memo = "") {
        const txRaw = await this.sign(signerAddress, messages, fee, memo);
        const txBytes = tx_3.TxRaw.encode(txRaw).finish();
        return this.broadcastTx(txBytes, this.broadcastTimeoutMs, this.broadcastPollIntervalMs);
    }
    async sign(signerAddress, messages, fee, memo, explicitSignerData) {
        let signerData;
        if (explicitSignerData) {
            signerData = explicitSignerData;
        }
        else {
            const { accountNumber, sequence } = await this.getSequence(signerAddress);
            const chainId = await this.getChainId();
            signerData = {
                accountNumber: accountNumber,
                sequence: sequence,
                chainId: chainId,
            };
        }
        return proto_signing_1.isOfflineDirectSigner(this.signer)
            ? this.signDirect(signerAddress, messages, fee, memo, signerData)
            : this.signAmino(signerAddress, messages, fee, memo, signerData);
    }
    async signAmino(signerAddress, messages, fee, memo, { accountNumber, sequence, chainId }) {
        utils_1.assert(!proto_signing_1.isOfflineDirectSigner(this.signer));
        const accountFromSigner = (await this.signer.getAccounts()).find((account) => account.address === signerAddress);
        if (!accountFromSigner) {
            throw new Error("Failed to retrieve account from signer");
        }
        const pubkey = proto_signing_1.encodePubkey(amino_1.encodeSecp256k1Pubkey(accountFromSigner.pubkey));
        const signMode = signing_1.SignMode.SIGN_MODE_LEGACY_AMINO_JSON;
        const msgs = messages.map((msg) => this.aminoTypes.toAmino(msg));
        const signDoc = amino_1.makeSignDoc(msgs, fee, chainId, memo, accountNumber, sequence);
        const { signature, signed } = await this.signer.signAmino(signerAddress, signDoc);
        const signedTxBody = {
            typeUrl: "/cosmos.tx.v1beta1.TxBody",
            value: {
                messages: signed.msgs.map((msg) => this.aminoTypes.fromAmino(msg)),
                memo: signed.memo,
            },
        };
        const signedTxBodyBytes = this.registry.encode(signedTxBody);
        const signedGasLimit = math_1.Int53.fromString(signed.fee.gas).toNumber();
        const signedSequence = math_1.Int53.fromString(signed.sequence).toNumber();
        const signedAuthInfoBytes = proto_signing_1.makeAuthInfoBytes([{ pubkey, sequence: signedSequence }], signed.fee.amount, signedGasLimit, signMode);
        return tx_3.TxRaw.fromPartial({
            bodyBytes: signedTxBodyBytes,
            authInfoBytes: signedAuthInfoBytes,
            signatures: [encoding_1.fromBase64(signature.signature)],
        });
    }
    async signDirect(signerAddress, messages, fee, memo, { accountNumber, sequence, chainId }) {
        utils_1.assert(proto_signing_1.isOfflineDirectSigner(this.signer));
        const accountFromSigner = (await this.signer.getAccounts()).find((account) => account.address === signerAddress);
        if (!accountFromSigner) {
            throw new Error("Failed to retrieve account from signer");
        }
        const pubkey = proto_signing_1.encodePubkey(amino_1.encodeSecp256k1Pubkey(accountFromSigner.pubkey));
        const txBody = {
            typeUrl: "/cosmos.tx.v1beta1.TxBody",
            value: {
                messages: messages,
                memo: memo,
            },
        };
        const txBodyBytes = this.registry.encode(txBody);
        const gasLimit = math_1.Int53.fromString(fee.gas).toNumber();
        const authInfoBytes = proto_signing_1.makeAuthInfoBytes([{ pubkey, sequence }], fee.amount, gasLimit);
        const signDoc = proto_signing_1.makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
        const { signature, signed } = await this.signer.signDirect(signerAddress, signDoc);
        return tx_3.TxRaw.fromPartial({
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [encoding_1.fromBase64(signature.signature)],
        });
    }
}
exports.SigningCosmWasmClient = SigningCosmWasmClient;
//# sourceMappingURL=signingcosmwasmclient.js.map