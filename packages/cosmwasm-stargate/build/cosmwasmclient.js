"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CosmWasmClient = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const encoding_1 = require("@cosmjs/encoding");
const math_1 = require("@cosmjs/math");
const stargate_1 = require("@cosmjs/stargate");
const tendermint_rpc_1 = require("@cosmjs/tendermint-rpc");
const utils_1 = require("@cosmjs/utils");
const types_1 = require("cosmjs-types/cosmwasm/wasm/v1/types");
const queries_1 = require("./queries");
class CosmWasmClient {
    constructor(tmClient) {
        this.codesCache = new Map();
        if (tmClient) {
            this.tmClient = tmClient;
            this.queryClient = stargate_1.QueryClient.withExtensions(tmClient, stargate_1.setupAuthExtension, stargate_1.setupBankExtension, queries_1.setupWasmExtension);
        }
    }
    static async connect(endpoint) {
        const tmClient = await tendermint_rpc_1.Tendermint34Client.connect(endpoint);
        return new CosmWasmClient(tmClient);
    }
    getTmClient() {
        return this.tmClient;
    }
    forceGetTmClient() {
        if (!this.tmClient) {
            throw new Error("Tendermint client not available. You cannot use online functionality in offline mode.");
        }
        return this.tmClient;
    }
    getQueryClient() {
        return this.queryClient;
    }
    forceGetQueryClient() {
        if (!this.queryClient) {
            throw new Error("Query client not available. You cannot use online functionality in offline mode.");
        }
        return this.queryClient;
    }
    async getChainId() {
        if (!this.chainId) {
            const response = await this.forceGetTmClient().status();
            const chainId = response.nodeInfo.network;
            if (!chainId)
                throw new Error("Chain ID must not be empty");
            this.chainId = chainId;
        }
        return this.chainId;
    }
    async getHeight() {
        const status = await this.forceGetTmClient().status();
        return status.syncInfo.latestBlockHeight;
    }
    async getAccount(searchAddress) {
        try {
            const account = await this.forceGetQueryClient().auth.account(searchAddress);
            return account ? stargate_1.accountFromAny(account) : null;
        }
        catch (error) {
            if (/rpc error: code = NotFound/i.test(error)) {
                return null;
            }
            throw error;
        }
    }
    async getSequence(address) {
        const account = await this.getAccount(address);
        if (!account) {
            throw new Error("Account does not exist on chain. Send some tokens there before trying to query sequence.");
        }
        return {
            accountNumber: account.accountNumber,
            sequence: account.sequence,
        };
    }
    async getBlock(height) {
        const response = await this.forceGetTmClient().block(height);
        return {
            id: encoding_1.toHex(response.blockId.hash).toUpperCase(),
            header: {
                version: {
                    block: new math_1.Uint53(response.block.header.version.block).toString(),
                    app: new math_1.Uint53(response.block.header.version.app).toString(),
                },
                height: response.block.header.height,
                chainId: response.block.header.chainId,
                time: tendermint_rpc_1.toRfc3339WithNanoseconds(response.block.header.time),
            },
            txs: response.block.txs,
        };
    }
    async getBalance(address, searchDenom) {
        return this.forceGetQueryClient().bank.balance(address, searchDenom);
    }
    async getTx(id) {
        var _a;
        const results = await this.txsQuery(`tx.hash='${id}'`);
        return (_a = results[0]) !== null && _a !== void 0 ? _a : null;
    }
    async searchTx(query, filter = {}) {
        const minHeight = filter.minHeight || 0;
        const maxHeight = filter.maxHeight || Number.MAX_SAFE_INTEGER;
        if (maxHeight < minHeight)
            return []; // optional optimization
        function withFilters(originalQuery) {
            return `${originalQuery} AND tx.height>=${minHeight} AND tx.height<=${maxHeight}`;
        }
        let txs;
        if (stargate_1.isSearchByHeightQuery(query)) {
            txs =
                query.height >= minHeight && query.height <= maxHeight
                    ? await this.txsQuery(`tx.height=${query.height}`)
                    : [];
        }
        else if (stargate_1.isSearchBySentFromOrToQuery(query)) {
            const sentQuery = withFilters(`message.module='bank' AND transfer.sender='${query.sentFromOrTo}'`);
            const receivedQuery = withFilters(`message.module='bank' AND transfer.recipient='${query.sentFromOrTo}'`);
            const [sent, received] = await Promise.all([sentQuery, receivedQuery].map((rawQuery) => this.txsQuery(rawQuery)));
            const sentHashes = sent.map((t) => t.hash);
            txs = [...sent, ...received.filter((t) => !sentHashes.includes(t.hash))];
        }
        else if (stargate_1.isSearchByTagsQuery(query)) {
            const rawQuery = withFilters(query.tags.map((t) => `${t.key}='${t.value}'`).join(" AND "));
            txs = await this.txsQuery(rawQuery);
        }
        else {
            throw new Error("Unknown query type");
        }
        const filtered = txs.filter((tx) => tx.height >= minHeight && tx.height <= maxHeight);
        return filtered;
    }
    disconnect() {
        if (this.tmClient)
            this.tmClient.disconnect();
    }
    /**
     * Broadcasts a signed transaction to the network and monitors its inclusion in a block.
     *
     * If broadcasting is rejected by the node for some reason (e.g. because of a CheckTx failure),
     * an error is thrown.
     *
     * If the transaction is not included in a block before the provided timeout, this errors with a `TimeoutError`.
     *
     * If the transaction is included in a block, a `BroadcastTxResponse` is returned. The caller then
     * usually needs to check for execution success or failure.
     */
    // NOTE: This method is tested against slow chains and timeouts in the @cosmjs/stargate package.
    // Make sure it is kept in sync!
    async broadcastTx(tx, timeoutMs = 60000, pollIntervalMs = 3000) {
        let timedOut = false;
        const txPollTimeout = setTimeout(() => {
            timedOut = true;
        }, timeoutMs);
        const pollForTx = async (txId) => {
            if (timedOut) {
                throw new stargate_1.TimeoutError(`Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later.`, txId);
            }
            await utils_1.sleep(pollIntervalMs);
            const result = await this.getTx(txId);
            return result
                ? {
                    code: result.code,
                    height: result.height,
                    rawLog: result.rawLog,
                    transactionHash: txId,
                    gasUsed: result.gasUsed,
                    gasWanted: result.gasWanted,
                }
                : pollForTx(txId);
        };
        const broadcasted = await this.forceGetTmClient().broadcastTxSync({ tx });
        if (broadcasted.code) {
            throw new Error(`Broadcasting transaction failed with code ${broadcasted.code} (codespace: ${broadcasted.codeSpace}). Log: ${broadcasted.log}`);
        }
        const transactionId = encoding_1.toHex(broadcasted.hash).toUpperCase();
        return new Promise((resolve, reject) => pollForTx(transactionId).then((value) => {
            clearTimeout(txPollTimeout);
            resolve(value);
        }, (error) => {
            clearTimeout(txPollTimeout);
            reject(error);
        }));
    }
    async getCodes() {
        const { codeInfos } = await this.forceGetQueryClient().wasm.listCodeInfo();
        return (codeInfos || []).map((entry) => {
            utils_1.assert(entry.creator && entry.codeId && entry.dataHash, "entry incomplete");
            return {
                id: entry.codeId.toNumber(),
                creator: entry.creator,
                checksum: encoding_1.toHex(entry.dataHash),
            };
        });
    }
    async getCodeDetails(codeId) {
        const cached = this.codesCache.get(codeId);
        if (cached)
            return cached;
        const { codeInfo, data } = await this.forceGetQueryClient().wasm.getCode(codeId);
        utils_1.assert(codeInfo && codeInfo.codeId && codeInfo.creator && codeInfo.dataHash && data, "codeInfo missing or incomplete");
        const codeDetails = {
            id: codeInfo.codeId.toNumber(),
            creator: codeInfo.creator,
            checksum: encoding_1.toHex(codeInfo.dataHash),
            data: data,
        };
        this.codesCache.set(codeId, codeDetails);
        return codeDetails;
    }
    async getContracts(codeId) {
        // TODO: handle pagination - accept as arg or auto-loop
        const { contracts } = await this.forceGetQueryClient().wasm.listContractsByCodeId(codeId);
        return contracts;
    }
    /**
     * Throws an error if no contract was found at the address
     */
    async getContract(address) {
        const { address: retrievedAddress, contractInfo } = await this.forceGetQueryClient().wasm.getContractInfo(address);
        if (!contractInfo)
            throw new Error(`No contract found at address "${address}"`);
        utils_1.assert(retrievedAddress, "address missing");
        utils_1.assert(contractInfo.codeId && contractInfo.creator && contractInfo.label, "contractInfo incomplete");
        return {
            address: retrievedAddress,
            codeId: contractInfo.codeId.toNumber(),
            creator: contractInfo.creator,
            admin: contractInfo.admin || undefined,
            label: contractInfo.label,
            ibcPortId: contractInfo.ibcPortId || undefined,
        };
    }
    /**
     * Throws an error if no contract was found at the address
     */
    async getContractCodeHistory(address) {
        const result = await this.forceGetQueryClient().wasm.getContractCodeHistory(address);
        if (!result)
            throw new Error(`No contract history found for address "${address}"`);
        const operations = {
            [types_1.ContractCodeHistoryOperationType.CONTRACT_CODE_HISTORY_OPERATION_TYPE_INIT]: "Init",
            [types_1.ContractCodeHistoryOperationType.CONTRACT_CODE_HISTORY_OPERATION_TYPE_GENESIS]: "Genesis",
            [types_1.ContractCodeHistoryOperationType.CONTRACT_CODE_HISTORY_OPERATION_TYPE_MIGRATE]: "Migrate",
        };
        return (result.entries || []).map((entry) => {
            utils_1.assert(entry.operation && entry.codeId && entry.msg);
            return {
                operation: operations[entry.operation],
                codeId: entry.codeId.toNumber(),
                msg: JSON.parse(encoding_1.fromAscii(entry.msg)),
            };
        });
    }
    /**
     * Returns the data at the key if present (raw contract dependent storage data)
     * or null if no data at this key.
     *
     * Promise is rejected when contract does not exist.
     */
    async queryContractRaw(address, key) {
        // just test contract existence
        await this.getContract(address);
        const { data } = await this.forceGetQueryClient().wasm.queryContractRaw(address, key);
        return data !== null && data !== void 0 ? data : null;
    }
    /**
     * Makes a smart query on the contract, returns the parsed JSON document.
     *
     * Promise is rejected when contract does not exist.
     * Promise is rejected for invalid query format.
     * Promise is rejected for invalid response format.
     */
    async queryContractSmart(address, queryMsg) {
        try {
            return await this.forceGetQueryClient().wasm.queryContractSmart(address, queryMsg);
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.startsWith("not found: contract")) {
                    throw new Error(`No contract found at address "${address}"`);
                }
                else {
                    throw error;
                }
            }
            else {
                throw error;
            }
        }
    }
    async txsQuery(query) {
        const results = await this.forceGetTmClient().txSearchAll({ query: query });
        return results.txs.map((tx) => {
            return {
                height: tx.height,
                hash: encoding_1.toHex(tx.hash).toUpperCase(),
                code: tx.result.code,
                rawLog: tx.result.log || "",
                tx: tx.tx,
                gasUsed: tx.result.gasUsed,
                gasWanted: tx.result.gasWanted,
            };
        });
    }
}
exports.CosmWasmClient = CosmWasmClient;
//# sourceMappingURL=cosmwasmclient.js.map