"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosmWasmTypes = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const encoding_1 = require("@cosmjs/encoding");
const long_1 = __importDefault(require("long"));
exports.cosmWasmTypes = {
    "/cosmwasm.wasm.v1.MsgStoreCode": {
        aminoType: "wasm/MsgStoreCode",
        toAmino: ({ sender, wasmByteCode }) => ({
            sender: sender,
            wasm_byte_code: encoding_1.toBase64(wasmByteCode),
        }),
        fromAmino: ({ sender, wasm_byte_code }) => ({
            sender: sender,
            wasmByteCode: encoding_1.fromBase64(wasm_byte_code),
            instantiatePermission: undefined,
        }),
    },
    "/cosmwasm.wasm.v1.MsgInstantiateContract": {
        aminoType: "wasm/MsgInstantiateContract",
        toAmino: ({ sender, codeId, label, msg, funds, admin, }) => ({
            sender: sender,
            code_id: codeId.toString(),
            label: label,
            msg: JSON.parse(encoding_1.fromUtf8(msg)),
            funds: funds,
            admin: admin !== null && admin !== void 0 ? admin : undefined,
        }),
        fromAmino: ({ sender, code_id, label, msg, funds, admin, }) => ({
            sender: sender,
            codeId: long_1.default.fromString(code_id),
            label: label,
            msg: encoding_1.toUtf8(JSON.stringify(msg)),
            funds: [...funds],
            admin: admin !== null && admin !== void 0 ? admin : "",
        }),
    },
    "/cosmwasm.wasm.v1.MsgUpdateAdmin": {
        aminoType: "wasm/MsgUpdateAdmin",
        toAmino: ({ sender, newAdmin, contract }) => ({
            sender: sender,
            new_admin: newAdmin,
            contract: contract,
        }),
        fromAmino: ({ sender, new_admin, contract }) => ({
            sender: sender,
            newAdmin: new_admin,
            contract: contract,
        }),
    },
    "/cosmwasm.wasm.v1.MsgClearAdmin": {
        aminoType: "wasm/MsgClearAdmin",
        toAmino: ({ sender, contract }) => ({
            sender: sender,
            contract: contract,
        }),
        fromAmino: ({ sender, contract }) => ({
            sender: sender,
            contract: contract,
        }),
    },
    "/cosmwasm.wasm.v1.MsgExecuteContract": {
        aminoType: "wasm/MsgExecuteContract",
        toAmino: ({ sender, contract, msg, funds }) => ({
            sender: sender,
            contract: contract,
            msg: JSON.parse(encoding_1.fromUtf8(msg)),
            funds: funds,
        }),
        fromAmino: ({ sender, contract, msg, funds }) => ({
            sender: sender,
            contract: contract,
            msg: encoding_1.toUtf8(JSON.stringify(msg)),
            funds: [...funds],
        }),
    },
    "/cosmwasm.wasm.v1.MsgMigrateContract": {
        aminoType: "wasm/MsgMigrateContract",
        toAmino: ({ sender, contract, codeId, msg }) => ({
            sender: sender,
            contract: contract,
            code_id: codeId.toString(),
            msg: JSON.parse(encoding_1.fromUtf8(msg)),
        }),
        fromAmino: ({ sender, contract, code_id, msg, }) => ({
            sender: sender,
            contract: contract,
            codeId: long_1.default.fromString(code_id),
            msg: encoding_1.toUtf8(JSON.stringify(msg)),
        }),
    },
};
//# sourceMappingURL=aminotypes.js.map