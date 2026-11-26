using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Models;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController(SettingsService settings) : ControllerBase
{
    [HttpGet("store")]
    public async Task<ActionResult<StoreSettingsDto>> Store()
        => Ok(await settings.GetStoreAsync());

    [HttpPut("store")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<StoreSettingsDto>> UpdateStore([FromBody] UpdateStoreSettingsRequest request)
    {
        try
        {
            return Ok(await settings.UpdateStoreAsync(request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
