import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/api/config";

export function SearchPagination({ page, pageSize, total, onPage, onPageSize }: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-sm">
    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
      <span>Por página</span>
      <Select value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))}>
        <SelectTrigger aria-label="Registros por página" className="h-8 w-20"><SelectValue /></SelectTrigger>
        <SelectContent>{PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
      </Select>
      <span>{total} registros</span>
    </div>
    <div className="flex items-center gap-2">
      <Button aria-label="Página anterior" title="Página anterior" size="icon" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-muted-foreground">Página <strong className="text-foreground">{page}</strong> de {totalPages}</span>
      <Button aria-label="Próxima página" title="Próxima página" size="icon" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  </div>;
}