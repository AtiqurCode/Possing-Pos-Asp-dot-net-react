using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/sales")]
[Authorize]
public class SalesController(SaleService sales) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SaleListItemDto>>> GetAll(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
        => Ok(await sales.GetAllAsync(from, to));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SaleDto>> GetById(Guid id)
    {
        var sale = await sales.GetByIdAsync(id);
        return sale is null ? NotFound() : Ok(sale);
    }

    [HttpPost]
    public async Task<ActionResult<SaleDto>> Create([FromBody] CreateSaleRequest request)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idValue, out var userId))
            return Unauthorized();

        try
        {
            var sale = await sales.CreateAsync(userId, request);
            return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
