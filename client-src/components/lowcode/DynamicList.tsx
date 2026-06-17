import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Download, Upload, MoreVertical, Eye, Edit, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as Icons from "lucide-react";

interface Field {
  id: number;
  field_name: string;
  label: string;
  field_type: string;
  in_list_view: boolean;
  in_filter: boolean;
}

interface DynamicListProps {
  docTypeName: string;
  data?: any[];
  onNew?: () => void;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  customActions?: { label: string; icon: string; onClick: (item: any) => void }[];
}

export function DynamicList({ 
  docTypeName, 
  data = [], 
  onNew, 
  onView, 
  onEdit, 
  onDelete,
  customActions = []
}: DynamicListProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data: schema, isLoading } = useQuery({
    queryKey: ["/api/lowcode/doctypes", docTypeName, "schema"],
    queryFn: async () => {
      const res = await fetch(`/api/lowcode/doctypes/${docTypeName}/schema`);
      if (!res.ok) throw new Error("Failed to fetch schema");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        DocType não encontrado
      </div>
    );
  }

  const fields = (schema.fields as Field[]).filter(f => f.in_list_view);
  const filterFields = (schema.fields as Field[]).filter(f => f.in_filter);
  const IconComponent = (Icons as any)[schema.doctype.icon] || Icons.FileText;

  const filteredData = data.filter(item => {
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = fields.some(field => {
        const value = item[field.field_name];
        return value && String(value).toLowerCase().includes(searchLower);
      });
      if (!matchesSearch) return false;
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value && item[key] !== value) return false;
    }

    return true;
  });

  const formatValue = (value: any, fieldType: string) => {
    if (value === null || value === undefined) return "-";
    
    switch (fieldType) {
      case "date":
        return new Date(value).toLocaleDateString("pt-BR");
      case "datetime":
        return new Date(value).toLocaleString("pt-BR");
      case "currency":
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      case "check":
      case "boolean":
        return value ? "Sim" : "Não";
      default:
        return String(value);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${schema.doctype.color || "blue"}-100 flex items-center justify-center`}>
              <IconComponent className={`h-5 w-5 text-${schema.doctype.color || "blue"}-600`} />
            </div>
            <div>
              <CardTitle>{schema.doctype.label}</CardTitle>
              {schema.doctype.description && (
                <p className="text-sm text-muted-foreground">{schema.doctype.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {schema.doctype.allow_import && (
              <Button variant="outline" size="sm" data-testid="button-import">
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
            )}
            {schema.doctype.allow_export && (
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
            {onNew && (
              <Button onClick={onNew} data-testid="button-new">
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {filterFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-filter">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {filterFields.map((field) => (
                  <div key={field.id} className="p-2">
                    <label className="text-sm font-medium">{field.label}</label>
                    <Input
                      value={filters[field.field_name] || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                      placeholder={`Filtrar ${field.label}...`}
                      className="mt-1"
                    />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((field) => (
                  <TableHead key={field.id}>{field.label}</TableHead>
                ))}
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={fields.length + 1} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => (
                  <TableRow key={item.id || index} data-testid={`row-${docTypeName}-${item.id || index}`}>
                    {fields.map((field) => (
                      <TableCell key={field.id}>
                        {formatValue(item[field.field_name], field.field_type)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${item.id || index}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onView && (
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {customActions.map((action, i) => {
                            const ActionIcon = (Icons as any)[action.icon] || Icons.Circle;
                            return (
                              <DropdownMenuItem key={i} onClick={() => action.onClick(item)}>
                                <ActionIcon className="h-4 w-4 mr-2" />
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                          {onDelete && (
                            <DropdownMenuItem onClick={() => onDelete(item)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{filteredData.length} registro(s)</span>
        </div>
      </CardContent>
    </Card>
  );
}
