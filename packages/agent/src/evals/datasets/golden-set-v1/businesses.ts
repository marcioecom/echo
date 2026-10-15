import type { GoldenBusiness, KnowledgeChunk } from "../../types"

function chunk(
  id: string,
  documentTitle: string,
  sentences: string[]
): KnowledgeChunk {
  return {
    id,
    documentId: `doc-${id}`,
    documentTitle,
    content: sentences.join(" "),
  }
}

export const goldenBusinesses: Record<GoldenBusiness["id"], GoldenBusiness> = {
  "padaria-sol": {
    id: "padaria-sol",
    name: "Padaria Sol",
    organizationId: "org-padaria-sol",
    chunks: [
      chunk("padaria-horario", "Horário", [
        "A Padaria Sol abre de segunda a sexta das 6h às 20h.",
        "No sábado abre das 6h às 18h e no domingo das 7h às 13h.",
        "Em feriado o horário é das 7h às 12h.",
      ]),
      chunk("padaria-paes", "Pães", [
        "O pão francês custa R$ 1,20 a unidade e a meia dúzia custa R$ 6,50.",
        "Pão na chapa com manteiga custa R$ 8 e com queijo custa R$ 12.",
        "Sonho de creme custa R$ 7 e croissant custa R$ 9.",
      ]),
      chunk("padaria-bolos", "Bolos", [
        "A fatia de bolo de cenoura com chocolate custa R$ 12.",
        "O bolo de cenoura inteiro custa R$ 70 e o de chocolate inteiro custa R$ 80.",
        "Bolo de festa, a partir de 20 fatias, custa R$ 160 e precisa de 48 horas de antecedência.",
        "Não fazemos bolo sem lactose nem sem glúten.",
      ]),
      chunk("padaria-entrega", "Entrega", [
        "Entregamos na Vila Aurora e no Jardim das Flores, com taxa de R$ 8 e pedido mínimo de R$ 30.",
        "Pedido feito pelo WhatsApp até as 18h sai no mesmo dia, de segunda a sábado.",
        "Não entregamos domingo nem feriado.",
        "A retirada é na Rua das Acácias, 120.",
      ]),
      chunk("padaria-pagamento", "Pagamento", [
        "Aceitamos dinheiro, Pix e cartão de débito ou crédito à vista.",
        "A chave Pix é padariasol@example.com.",
        "Não parcelamos e não aceitamos vale-refeição.",
      ]),
      chunk("padaria-salgados", "Salgados", [
        "O cento misto de coxinha, bolinha de queijo e quibe custa R$ 90.",
        "A encomenda de salgados precisa de 24 horas.",
        "O salgado avulso custa R$ 7 e a retirada é na loja.",
      ]),
      chunk("padaria-cafe", "Café", [
        "Café expresso custa R$ 5, pingado custa R$ 6 e suco de laranja custa R$ 9.",
        "Não vendemos café coado em garrafa.",
      ]),
      chunk("padaria-contato", "Contato", [
        "Pedidos são feitos por este WhatsApp.",
        "O telefone da loja é (11) 4000-1212 e não anotamos pedido por ligação depois das 18h.",
      ]),
    ],
  },
  "clinica-luna": {
    id: "clinica-luna",
    name: "Clínica Luna",
    organizationId: "org-clinica-luna",
    chunks: [
      chunk("clinica-horario", "Horário", [
        "A Clínica Luna atende de terça a sexta das 9h às 19h e no sábado das 9h às 14h.",
        "Domingo e segunda estamos fechados.",
        "O atendimento é somente com hora marcada.",
      ]),
      chunk("clinica-limpeza", "Limpeza de pele", [
        "A limpeza de pele dura 50 minutos e custa R$ 180.",
        "A limpeza com extração e máscara de argila dura 70 minutos e custa R$ 230.",
        "A primeira visita inclui avaliação.",
        "Se a pele estiver com acne inflamada no dia, a profissional remarca.",
      ]),
      chunk("clinica-drenagem", "Drenagem", [
        "A drenagem de 40 minutos custa R$ 120 e a de 60 minutos custa R$ 160.",
        "O pacote de 5 sessões de 60 minutos custa R$ 700 e vale por 60 dias.",
        "Não fazemos drenagem no primeiro trimestre de gestação.",
      ]),
      chunk("clinica-agendamento", "Agendamento", [
        "Para agendar pedimos o nome completo e o procedimento.",
        "A confirmação chega por WhatsApp.",
        "Cancelar até 12 horas antes não tem custo.",
        "Falta ou cancelamento em cima da hora cobra 50% do valor do procedimento.",
      ]),
      chunk("clinica-pagamento", "Pagamento", [
        "Aceitamos Pix, dinheiro e cartão.",
        "Procedimentos acima de R$ 200 podem ser pagos em até 2 vezes sem juros.",
        "Não fazemos day spa nem pacote de noiva e não vendemos produto para levar.",
      ]),
      chunk("clinica-nao-faz", "O que não fazemos", [
        "Não aplicamos botox, preenchimento nem peeling químico médio.",
        "Não fazemos procedimento invasivo, não emitimos atestado e não diagnosticamos a pele.",
        "Queixa de mancha, alergia ou reação depois do procedimento é encaminhada para a profissional responsável.",
      ]),
      chunk("clinica-endereco", "Endereço", [
        "A clínica fica na Rua das Gardênias, 88, sala 2, Vila Aurora.",
        "A primeira hora do estacionamento do prédio é por conta da clínica.",
      ]),
      chunk("clinica-home-care", "Orientação", [
        "Não vendemos creme, sérum nem produto para casa.",
        "A orientação de cuidado depois da sessão é dada pela profissional, sem marca obrigatória.",
      ]),
    ],
  },
  "pet-shop-bicho": {
    id: "pet-shop-bicho",
    name: "Pet Shop Bicho Feliz",
    organizationId: "org-pet-shop-bicho",
    chunks: [
      chunk("pet-horario", "Horário", [
        "O Pet Shop Bicho Feliz abre de segunda a sexta das 8h às 18h e no sábado das 8h às 13h.",
        "Domingo fechado.",
        "Banho e tosa deixam de entrar uma hora antes de fechar.",
      ]),
      chunk("pet-banho", "Banho", [
        "Banho de cão até 10 kg custa R$ 50.",
        "De 11 a 25 kg custa R$ 70 e de 26 a 40 kg custa R$ 95.",
        "Acima de 40 kg o banho é sob consulta.",
        "O banho inclui secagem e perfume neutro.",
        "Não damos banho em gato.",
      ]),
      chunk("pet-tosa", "Tosa", [
        "A tosa higiênica custa R$ 40 em qualquer porte.",
        "Tosa na tesoura ou na máquina custa R$ 80 no porte pequeno e R$ 110 no porte médio.",
        "A tosa completa já inclui o banho.",
        "Pedimos a carteira de vacina antirrábica em dia.",
      ]),
      chunk("pet-taxi", "Leva e traz", [
        "Buscamos e levamos no Centro e no Jardim Europa por R$ 25 cada trajeto.",
        "O horário de busca é combinado na véspera.",
        "Não buscamos aos domingos.",
      ]),
      chunk("pet-racao", "Ração", [
        "Vendemos ração Golden e Premier para cães e gatos.",
        "O saco de 15 kg da Golden Special para cães adultos custa R$ 175.",
        "Não entregamos ração; a retirada é na loja.",
        "Não trabalhamos com ração medicamentosa.",
      ]),
      chunk("pet-vacina", "Vacina", [
        "Não aplicamos vacina.",
        "Indicamos a Clínica Vet Aurora, na mesma rua, número 40.",
        "Na tosa só conferimos a carteira.",
      ]),
      chunk("pet-endereco", "Endereço", [
        "A loja fica na Rua das Acácias, 200, Centro, ao lado da Clínica Vet Aurora.",
      ]),
      chunk("pet-gatos", "Gatos", [
        "Banho e tosa são só para cães.",
        "Vendemos areia e ração de gato.",
        "Não temos gatil.",
      ]),
    ],
  },
  "loja-linha": {
    id: "loja-linha",
    name: "Loja Linha",
    organizationId: "org-loja-linha",
    chunks: [
      chunk("roupa-horario", "Horário", [
        "A Loja Linha abre de segunda a sexta das 10h às 19h e no sábado das 10h às 16h.",
        "Domingo fechado.",
        "O provador fecha 30 minutos antes da loja.",
      ]),
      chunk("roupa-troca", "Troca", [
        "Trocamos em até 30 dias peça sem uso, com etiqueta e nota.",
        "Peça em promoção também troca se houver outro tamanho.",
        "Não trocamos peça lavada, com cheiro ou sem etiqueta.",
        "A troca é feita na loja; não buscamos em casa.",
      ]),
      chunk("roupa-frete", "Frete", [
        "Enviamos pelos Correios para todo o Brasil.",
        "O frete é grátis nas compras acima de R$ 299.",
        "Abaixo disso o frete é calculado pelo CEP.",
        "A postagem sai em até 2 dias úteis depois da confirmação do Pix.",
      ]),
      chunk("roupa-pagamento", "Pagamento", [
        "No Pix damos 5% de desconto.",
        "No cartão parcelamos em até 3 vezes sem juros.",
        "Não parcelamos em mais de 3 vezes.",
        "Não reservamos peça sem sinal de 30% via Pix.",
      ]),
      chunk("roupa-tamanhos", "Tamanhos", [
        "A camiseta básica vai do P ao GG e a calça jeans vai do 36 ao 46.",
        "Não trabalhamos com tamanho acima do GG nem com infantil.",
        "A tabela de medidas está em lojalinha.example.com/medidas.",
        "Na dúvida entre dois tamanhos, sugerimos o maior.",
      ]),
      chunk("roupa-presente", "Presente", [
        "Embrulhamos para presente sem custo na loja.",
        "No envio, a embalagem de presente custa R$ 12.",
        "Quando é presente, não colocamos o preço dentro; a nota fiscal vai por fora do pacote.",
      ]),
      chunk("roupa-contato", "Contato", [
        "Trocas e dúvidas de pedido são por este WhatsApp.",
        "O Instagram é @lojalinha e não atendemos por telefone.",
      ]),
      chunk("roupa-ajuste", "Ajuste", [
        "Não fazemos ajuste nem bordado.",
        "A costureira parceira é a Dona Célia, na rua de trás, por conta da cliente.",
      ]),
    ],
  },
}
