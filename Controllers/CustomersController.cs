using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Possing.Dtos;
using Possing.Services;

namespace Possing.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController(CustomerService customers) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> GetAll([FromQuery] string? search)
        => Ok(await customers.GetAllAsync(search));

    [HttpGet("lookup")]
    public async Task<ActionResult<CustomerLookupDto>> Lookup([FromQuery] string mobile)
    {
        var found = await customers.LookupByMobileAsync(mobile);
        return found is null ? NotFound(new { message = "Customer not found." }) : Ok(found);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Upsert([FromBody] UpsertCustomerRequest request)
    {
        try
        {
            var created = await customers.UpsertAsync(request);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
