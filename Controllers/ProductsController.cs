using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Models;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController(ProductService products) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? lowStockOnly)
        => Ok(await products.GetAllAsync(search, categoryId, lowStockOnly));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(Guid id)
    {
        var product = await products.GetByIdAsync(id);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("by-code/{code}")]
    public async Task<ActionResult<ProductDto>> GetByCode(string code)
    {
        var product = await products.GetByCodeAsync(code);
        return product is null ? NotFound(new { message = "Product not found." }) : Ok(product);
    }

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProductDto>> Create([FromBody] CreateProductRequest request)
    {
        if (!TryUserId(out var userId)) return Unauthorized();

        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name is required." });
            if (request.Price < 0 || request.Quantity < 0)
                return BadRequest(new { message = "Price and quantity must be >= 0." });

            var created = await products.CreateAsync(userId, request);
            return created is null
                ? BadRequest(new { message = "Subcategory not found." })
                : CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProductDto>> Update(Guid id, [FromBody] UpdateProductRequest request)
    {
        if (!TryUserId(out var userId)) return Unauthorized();

        try
        {
            var updated = await products.UpdateAsync(userId, id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/stock")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProductDto>> PatchStock(Guid id, [FromBody] PatchProductStockRequest request)
    {
        if (!TryUserId(out var userId)) return Unauthorized();

        try
        {
            var updated = await products.PatchStockAsync(userId, id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/image")]
    [Authorize(Roles = Roles.Admin)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<ProductDto>> UploadImage(Guid id, IFormFile file)
    {
        if (file is null)
            return BadRequest(new { message = "Image file is required." });

        try
        {
            var updated = await products.UploadImageAsync(id, file);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
        => await products.DeleteAsync(id) ? NoContent() : NotFound();

    private bool TryUserId(out Guid userId)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idValue, out userId);
    }
}
