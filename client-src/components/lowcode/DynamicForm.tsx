import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, X, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Field {
  id: number;
  field_name: string;
  label: string;
  field_type: string;
  options?: string;
  default_value?: string;
  mandatory: boolean;
  read_only: boolean;
  hidden: boolean;
  placeholder?: string;
  help_text?: string;
  section?: string;
}

interface DynamicFormProps {
  docTypeName: string;
  initialData?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export function DynamicForm({ docTypeName, initialData, onSubmit, onCancel, readOnly = false }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {});
  const queryClient = useQueryClient();

  const { data: schema, isLoading } = useQuery({
    queryKey: ["/api/lowcode/doctypes", docTypeName, "schema"],
    queryFn: async () => {
      const res = await fetch(`/api/lowcode/doctypes/${docTypeName}/schema`);
      if (!res.ok) throw new Error("Failed to fetch schema");
      return res.json();
    }
  });

  useEffect(() => {
    if (schema?.fields && !initialData) {
      const defaults: Record<string, any> = {};
      schema.fields.forEach((field: Field) => {
        if (field.default_value) {
          defaults[field.field_name] = field.default_value;
        }
      });
      setFormData(defaults);
    }
  }, [schema, initialData]);

  const handleChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const renderField = (field: Field) => {
    if (field.hidden) return null;

    const value = formData[field.field_name] ?? "";
    const isDisabled = readOnly || field.read_only;

    switch (field.field_type) {
      case "text":
      case "data":
        return (
          <Input
            data-testid={`input-${field.field_name}`}
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );

      case "number":
      case "int":
      case "float":
      case "currency":
        return (
          <Input
            data-testid={`input-${field.field_name}`}
            type="number"
            value={value}
            onChange={(e) => handleChange(field.field_name, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );

      case "textarea":
      case "long_text":
      case "text_editor":
        return (
          <Textarea
            data-testid={`textarea-${field.field_name}`}
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            disabled={isDisabled}
            required={field.mandatory}
            rows={4}
          />
        );

      case "select":
        const options = field.options?.split("\n").filter(Boolean) || [];
        return (
          <Select
            value={value}
            onValueChange={(val) => handleChange(field.field_name, val)}
            disabled={isDisabled}
          >
            <SelectTrigger data-testid={`select-${field.field_name}`}>
              <SelectValue placeholder={field.placeholder || "Selecione..."} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "check":
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              data-testid={`checkbox-${field.field_name}`}
              checked={value === true || value === "1" || value === 1}
              onCheckedChange={(checked) => handleChange(field.field_name, checked)}
              disabled={isDisabled}
            />
            <span className="text-sm text-muted-foreground">{field.help_text || "Sim"}</span>
          </div>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                data-testid={`date-${field.field_name}`}
                variant="outline"
                disabled={isDisabled}
                className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "dd/MM/yyyy") : "Selecione data..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => handleChange(field.field_name, date?.toISOString().split("T")[0])}
              />
            </PopoverContent>
          </Popover>
        );

      case "datetime":
        return (
          <Input
            data-testid={`datetime-${field.field_name}`}
            type="datetime-local"
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );

      case "email":
        return (
          <Input
            data-testid={`input-${field.field_name}`}
            type="email"
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || "email@exemplo.com"}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );

      case "phone":
        return (
          <Input
            data-testid={`input-${field.field_name}`}
            type="tel"
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || "(00) 00000-0000"}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );

      default:
        return (
          <Input
            data-testid={`input-${field.field_name}`}
            value={value}
            onChange={(e) => handleChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            disabled={isDisabled}
            required={field.mandatory}
          />
        );
    }
  };

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

  const fields = schema.fields as Field[];
  const sections = Array.from(new Set(fields.map(f => f.section).filter(Boolean))) as string[];
  const ungroupedFields = fields.filter(f => !f.section);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{schema.doctype.label}</h2>
        {!readOnly && (
          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button type="submit" data-testid="button-submit">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        )}
      </div>

      {ungroupedFields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ungroupedFields.map((field) => (
            <div key={field.id} className={field.field_type === "textarea" || field.field_type === "long_text" ? "col-span-2" : ""}>
              <Label htmlFor={field.field_name} className="flex items-center gap-1">
                {field.label}
                {field.mandatory && <span className="text-red-500">*</span>}
              </Label>
              <div className="mt-1">{renderField(field)}</div>
              {field.help_text && field.field_type !== "check" && (
                <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {sections.map((section) => (
        <Card key={section}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{section}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.filter(f => f.section === section).map((field) => (
                <div key={field.id} className={field.field_type === "textarea" || field.field_type === "long_text" ? "col-span-2" : ""}>
                  <Label htmlFor={field.field_name} className="flex items-center gap-1">
                    {field.label}
                    {field.mandatory && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="mt-1">{renderField(field)}</div>
                  {field.help_text && field.field_type !== "check" && (
                    <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </form>
  );
}
