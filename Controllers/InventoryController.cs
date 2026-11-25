using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Models;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public class InventoryController(InventoryService inventory) : ControllerBase
{
    [HttpGet("movements")]
    public async Task<ActionResult<IReadOnlyList<StockMovementDto>>> Movements(
        [FromQuery] Guid? productId,
        [FromQuery] string? type,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int take = 200)
        => Ok(await inventory.GetMovementsAsync(productId, type, from, to, take));

    [HttpGet("summary")]
    public async Task<ActionResult<InventorySummaryDto>> Summary([FromQuery] Guid? productId)
    {
        try
        {
            return Ok(await inventory.GetSummaryAsync(productId));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("receive")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProductDto>> Receive([FromBody] StockChangeRequest request)
    {
        if (!TryUserId(out var userId)) return Unauthorized();
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });

        try
        {
            return Ok(await inventory.ReceiveAsync(userId, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("missing")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProductDto>> Missing([FromBody] StockChangeRequest request)
    {
        if (!TryUserId(out var userId)) return Unauthorized();
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });

        try
        {
            return Ok(await inventory.MissingAsync(userId, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private bool TryUserId(out Guid userId)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idValue, out userId);
    }
}
