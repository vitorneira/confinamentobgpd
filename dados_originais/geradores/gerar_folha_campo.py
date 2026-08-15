# -*- coding: utf-8 -*-
"""
Gera a FOLHA DE CAMPO em PDF (para imprimir e anotar peso à mão).
- Modo individual: brincos impressos e ORDENADOS (prefixo alfabético, número crescente).
- Modo agregado: N linhas numeradas em branco.
Layout multi-coluna para aproveitar a página, com espaço largo para escrever o peso.
Cabeçalho enxuto: Fazenda, Lote/Curral, Data.
"""
import re, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

def sort_key(brinco):
    """Prefixo alfabético; número como número. 'BBG 998' antes de 'BBG 1004'.
    Brincos numéricos com sufixo de ano (897/24) ordenam pelo número antes da barra
    e ficam DEPOIS dos com prefixo textual."""
    b = str(brinco).strip()
    m = re.match(r'^([A-Za-zÀ-ÿ]+)\s*0*(\d+)', b)  # prefixo + numero
    if m:
        return (0, m.group(1).upper(), int(m.group(2)), b)
    m2 = re.match(r'^0*(\d+)', b)                   # so numero (ex 897/24)
    if m2:
        return (1, "", int(m2.group(1)), b)
    return (2, b.upper(), 0, b)

def draw_header(c, W, H, fazenda, lote, modo, page, pages):
    c.setFont("Helvetica-Bold", 15)
    c.drawString(15*mm, H-18*mm, "FOLHA DE PESAGEM — CAMPO")
    c.setFont("Helvetica", 10)
    c.drawRightString(W-15*mm, H-14*mm, f"Pág. {page}/{pages}")
    # caixas do cabeçalho
    c.setFont("Helvetica-Bold", 10)
    y = H-30*mm
    c.drawString(15*mm, y, "FAZENDA:")
    c.rect(38*mm, y-2*mm, 30*mm, 7*mm); c.setFont("Helvetica", 11); c.drawString(41*mm, y, fazenda or "")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(75*mm, y, "LOTE/CURRAL:")
    c.rect(108*mm, y-2*mm, 30*mm, 7*mm); c.setFont("Helvetica", 11); c.drawString(111*mm, y, str(lote) or "")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(150*mm, y, "DATA:")
    c.rect(163*mm, y-2*mm, 32*mm, 7*mm)
    c.setFont("Helvetica", 8); c.drawString(164*mm, y-6*mm, "____/____/______")
    # instrução
    c.setFont("Helvetica-Oblique", 8)
    if modo == "individual":
        c.drawString(15*mm, H-38*mm, "Anote o PESO (kg) na frente de cada brinco. Marque com X se o animal não for pesado.")
    else:
        c.drawString(15*mm, H-38*mm, "Anote BRINCO (se houver) e PESO (kg) em cada linha. Lote sem brinco: só o peso.")

def make_pdf(path, fazenda, lote, brincos=None, qtd=None, modo="individual"):
    c = canvas.Canvas(path, pagesize=A4)
    W, H = A4
    # área útil
    top = H-44*mm; bottom = 15*mm
    # colunas: individual cabe mais (brinco+peso); agregado idem (nº+brinco+peso)
    ncols = 3
    col_w = (W-30*mm)/ncols
    row_h = 9*mm            # espaço bom pra caneta
    rows_per_col = int((top-bottom)//row_h)
    per_page = rows_per_col*ncols

    if modo == "individual":
        items = sorted(brincos, key=sort_key)
        labels = [(str(b), "") for b in items]
    else:
        labels = [(str(i+1), "") for i in range(qtd)]  # linhas numeradas
    total = len(labels)
    pages = max(1, (total + per_page - 1)//per_page)

    idx = 0
    for p in range(pages):
        draw_header(c, W, H, fazenda, lote, modo, p+1, pages)
        for col in range(ncols):
            x = 15*mm + col*col_w
            y = top
            # títulos de coluna
            c.setFont("Helvetica-Bold", 8)
            if modo == "individual":
                c.drawString(x+1*mm, y+3*mm, "BRINCO")
                c.drawString(x+col_w-24*mm, y+3*mm, "PESO (kg)")
            else:
                c.drawString(x+1*mm, y+3*mm, "Nº")
                c.drawString(x+11*mm, y+3*mm, "BRINCO")
                c.drawString(x+col_w-24*mm, y+3*mm, "PESO (kg)")
            for r in range(rows_per_col):
                if idx >= total: break
                lab, _ = labels[idx]; idx += 1
                cy = y - r*row_h
                # linha base
                c.setLineWidth(0.4); c.line(x, cy-row_h+2*mm, x+col_w-4*mm, cy-row_h+2*mm)
                c.setFont("Helvetica", 10)
                if modo == "individual":
                    c.drawString(x+1*mm, cy-row_h+3.5*mm, lab)
                else:
                    c.drawString(x+1*mm, cy-row_h+3.5*mm, lab)   # numero da linha
                # caixa do peso
                c.rect(x+col_w-24*mm, cy-row_h+2.2*mm, 20*mm, row_h-2.5*mm)
        c.showPage()
    c.save()
    print("salvo:", path, "| itens:", total, "| páginas:", pages)

if __name__ == "__main__":
    # Exemplo INDIVIDUAL com brincos reais da BG (curral 2) — mostra a ordenação
    brincos_ex = ["BBG 3339","BBG 3356","BBG 998","BBG 1004","CAB 1227","CAB 1231",
                  "897/24","930/24","1615/24","BGNE 5/24","BBG 3440","BBG 3454",
                  "BBG 3455","BBG 3502","BBG 3384","BBG 3390","2004/24","1892/24"]
    make_pdf("/home/claude/pacote-confinamento/Folha_Campo_Individual_exemplo.pdf",
             fazenda="BG", lote="2", brincos=brincos_ex, modo="individual")
    # Exemplo AGREGADO: lote de 90 bois da PD, linhas numeradas em branco
    make_pdf("/home/claude/pacote-confinamento/Folha_Campo_Agregado_exemplo.pdf",
             fazenda="PD", lote="4", qtd=90, modo="agregado")
