using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(DashboardService dashboard) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary()
        => Ok(await dashboard.GetSummaryAsync());
}
