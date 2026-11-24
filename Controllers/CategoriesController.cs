using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Models;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController(CategoryService categories) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll()
        => Ok(await categories.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CreateCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });
        var created = await categories.CreateAsync(request);
        return CreatedAtAction(nameof(GetAll), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, [FromBody] UpdateCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });
        var updated = await categories.UpdateAsync(id, request);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
        => await categories.DeleteAsync(id) ? NoContent() : NotFound();
}
