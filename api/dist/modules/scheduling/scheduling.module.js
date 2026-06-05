"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const database_module_1 = require("../../database/database.module");
const basic_auth_guard_1 = require("../../common/guards/basic-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const cve_updater_service_1 = require("./cve-updater.service");
const scan_queue_controller_1 = require("./scan-queue.controller");
const scan_queue_service_1 = require("./scan-queue.service");
const scan_task_scheduler_service_1 = require("./scan-task-scheduler.service");
let SchedulingModule = class SchedulingModule {
};
exports.SchedulingModule = SchedulingModule;
exports.SchedulingModule = SchedulingModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [scan_queue_controller_1.ScanQueueController],
        providers: [cve_updater_service_1.CveUpdaterService, scan_queue_service_1.ScanQueueService, scan_task_scheduler_service_1.ScanTaskSchedulerService, core_1.Reflector, basic_auth_guard_1.BasicAuthGuard, roles_guard_1.RolesGuard],
        exports: [scan_queue_service_1.ScanQueueService]
    })
], SchedulingModule);
