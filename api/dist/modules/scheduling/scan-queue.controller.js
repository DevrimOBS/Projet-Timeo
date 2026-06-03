"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanQueueController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const role_enum_1 = require("../../common/enums/role.enum");
const basic_auth_guard_1 = require("../../common/guards/basic-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const scan_task_dto_1 = require("./dto/scan-task.dto");
const scan_queue_service_1 = require("./scan-queue.service");
let ScanQueueController = class ScanQueueController {
    constructor(scanQueueService) {
        this.scanQueueService = scanQueueService;
    }
    createTask(payload, request) {
        return this.scanQueueService.createTask(payload, request.user?.subject ?? "admin");
    }
    listTasks() {
        return this.scanQueueService.listTasks();
    }
    async claimTask(request, response) {
        const task = await this.scanQueueService.claimNextTask(request.user?.subject ?? "agent");
        if (!task) {
            response.status(common_1.HttpStatus.NO_CONTENT);
            return;
        }
        return task;
    }
    completeTask(taskId, payload, request) {
        return this.scanQueueService.completeTask(taskId, request.user?.subject ?? "agent", payload);
    }
};
exports.ScanQueueController = ScanQueueController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [scan_task_dto_1.CreateScanTaskDto, Object]),
    __metadata("design:returntype", void 0)
], ScanQueueController.prototype, "createTask", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN, role_enum_1.Role.VIEWER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ScanQueueController.prototype, "listTasks", null);
__decorate([
    (0, common_1.Post)("claim"),
    (0, common_1.HttpCode)(200),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.AGENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ScanQueueController.prototype, "claimTask", null);
__decorate([
    (0, common_1.Post)(":taskId/complete"),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.AGENT),
    __param(0, (0, common_1.Param)("taskId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, scan_task_dto_1.CompleteScanTaskDto, Object]),
    __metadata("design:returntype", void 0)
], ScanQueueController.prototype, "completeTask", null);
exports.ScanQueueController = ScanQueueController = __decorate([
    (0, common_1.Controller)("api/scan-tasks"),
    (0, common_1.UseGuards)(basic_auth_guard_1.BasicAuthGuard, roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Inject)(scan_queue_service_1.ScanQueueService)),
    __metadata("design:paramtypes", [scan_queue_service_1.ScanQueueService])
], ScanQueueController);
