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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const role_enum_1 = require("../../common/enums/role.enum");
const basic_auth_guard_1 = require("../../common/guards/basic-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    getOverview() {
        return this.reportsService.getOverview();
    }
    getMatrix() {
        return this.reportsService.getMatrix();
    }
    getContainers() {
        return this.reportsService.getContainers();
    }
    getContainerDetails(containerId) {
        return this.reportsService.getContainerDetails(containerId);
    }
    listAlerts() {
        return this.reportsService.listAlerts();
    }
    acknowledgeAlert(alertId, request) {
        return this.reportsService.acknowledgeAlert(alertId, request.user?.subject ?? "admin");
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)("overview"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)("matrix"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getMatrix", null);
__decorate([
    (0, common_1.Get)("containers"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getContainers", null);
__decorate([
    (0, common_1.Get)("details/:containerId"),
    __param(0, (0, common_1.Param)("containerId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getContainerDetails", null);
__decorate([
    (0, common_1.Get)("alerts"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "listAlerts", null);
__decorate([
    (0, common_1.Post)("alerts/:alertId/ack"),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("alertId")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "acknowledgeAlert", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)("api/reports"),
    (0, common_1.UseGuards)(basic_auth_guard_1.BasicAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN, role_enum_1.Role.VIEWER),
    __param(0, (0, common_1.Inject)(reports_service_1.ReportsService)),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
