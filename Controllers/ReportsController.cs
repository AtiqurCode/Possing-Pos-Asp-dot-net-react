using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController(ReportService reports) : ControllerBase
{
    [HttpGet("analytics")]
    public async Task<ActionResult<ReportAnalyticsDto>> Analytics([FromQuery] int year, [FromQuery] int month)
    {
        if (year < 2000 || year > 2100 || month is < 1 or > 12)
            return BadRequest(new { message = "Invalid year or month." });
        return Ok(await reports.GetAnalyticsAsync(year, month));
    }

    [HttpGet("sales/{id:guid}/slip.pdf")]
    public async Task<IActionResult> SaleSlip(Guid id)
    {
        var pdf = await reports.GenerateSaleSlipAsync(id);
        return pdf is null ? NotFound() : File(pdf, "application/pdf", $"slip-{id}.pdf");
    }

    [HttpGet("monthly")]
    public async Task<IActionResult> Monthly([FromQuery] int year, [FromQuery] int month)
    {
        if (year < 2000 || year > 2100 || month is < 1 or > 12)
            return BadRequest(new { message = "Invalid year or month." });

        var pdf = await reports.GenerateMonthlyReportAsync(year, month);
        return File(pdf, "application/pdf", $"monthly-{year}-{month:D2}.pdf");
    }
}
