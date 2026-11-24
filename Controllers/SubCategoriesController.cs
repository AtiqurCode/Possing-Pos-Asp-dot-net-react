using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Models;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/subcategories")]
[Authorize]
public class SubCategoriesController(CategoryService categories) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SubCategoryDto>>> GetAll([FromQuery] Guid? categoryId)
        => Ok(await categories.GetSubCategoriesAsync(categoryId));

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<SubCategoryDto>> Create([FromBody] CreateSubCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });
        var created = await categories.CreateSubCategoryAsync(request);
        return created is null ? BadRequest(new { message = "Category not found." }) : Ok(created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<SubCategoryDto>> Update(Guid id, [FromBody] UpdateSubCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });
        var updated = await categories.UpdateSubCategoryAsync(id, request);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            return await categories.DeleteSubCategoryAsync(id) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
