namespace Possing.Dtos;

public record CategoryDto(Guid Id, string Name, int SubCategoryCount);
public record CreateCategoryRequest(string Name);
public record UpdateCategoryRequest(string Name);

public record SubCategoryDto(Guid Id, Guid CategoryId, string CategoryName, string Name, int ProductCount);
public record CreateSubCategoryRequest(Guid CategoryId, string Name);
public record UpdateSubCategoryRequest(Guid CategoryId, string Name);
