"use strict";
/*
 * DEPRECATED: in-memory `store.ts`
 *
 * Cette implementation est conservée pour développement/local et documentation,
 * mais l'application principale utilise désormais PostgreSQL via
 * `DatabaseService` (voir `api/src/database/database.service.ts`).
 *
 * Ne pas utiliser en production. Préférer les appels à la base de données
 * relationnelle. Ce fichier est laissé pour compatibilité locale et tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
exports.addScan = addScan;
exports.queueTrigger = queueTrigger;
exports.markTriggerDone = markTriggerDone;
exports.upsertSchedule = upsertSchedule;
exports.listVulnerabilities = listVulnerabilities;
const crypto_1 = require("crypto");
exports.store = {
    scans: [],
    schedules: [],
    triggers: []
};
function addScan(scan) {
    const item = {
        ...scan,
        scanId: scan.scanId ?? (0, crypto_1.randomUUID)()
    };
    exports.store.scans.unshift(item);
    return item;
}
function queueTrigger(mode, containerIds) {
    const trigger = {
        id: (0, crypto_1.randomUUID)(),
        mode,
        containerIds,
        createdAt: new Date().toISOString(),
        status: "queued"
    };
    exports.store.triggers.unshift(trigger);
    return trigger;
}
function markTriggerDone(id) {
    const target = exports.store.triggers.find((item) => item.id === id);
    if (target) {
        target.status = "done";
    }
}
function upsertSchedule(schedule) {
    const created = {
        id: (0, crypto_1.randomUUID)(),
        createdAt: new Date().toISOString(),
        ...schedule
    };
    exports.store.schedules.unshift(created);
    return created;
}
function listVulnerabilities(containerId, severity) {
    const vulnerabilities = exports.store.scans.flatMap((scan) => scan.containers.flatMap((container) => container.vulnerabilities
        .filter((vuln) => (severity ? vuln.severity === severity : true))
        .filter(() => (containerId ? container.containerId === containerId : true))));
    return vulnerabilities;
}
