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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteScanTaskDto = exports.CreateScanTaskDto = void 0;
const class_validator_1 = require("class-validator");
const TASK_MODES = ["MANUAL_GLOBAL", "MANUAL_TARGET", "AUTO_CRON"];
const TASK_STATUSES = ["queued", "processing", "completed", "failed"];
class CreateScanTaskDto {
}
exports.CreateScanTaskDto = CreateScanTaskDto;
__decorate([
    (0, class_validator_1.IsIn)(TASK_MODES),
    __metadata("design:type", Object)
], CreateScanTaskDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateScanTaskDto.prototype, "container_ids", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateScanTaskDto.prototype, "message", void 0);
class CompleteScanTaskDto {
}
exports.CompleteScanTaskDto = CompleteScanTaskDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteScanTaskDto.prototype, "scan_id", void 0);
__decorate([
    (0, class_validator_1.IsIn)(TASK_STATUSES),
    __metadata("design:type", Object)
], CompleteScanTaskDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteScanTaskDto.prototype, "message", void 0);
