export type Locale = 'pt' | 'en' | 'fr';

const dictionaries = {
    pt: {
        nav: {
            home: 'Início',
            about: 'Sobre',
            promotions: 'Promoções',
            contact: 'Contacto',
        },
        promo: {
            interested: 'Interessado nesta oferta?',
            contactText: 'Entre em contacto connosco para saber mais detalhes ou personalizar a sua viagem.',
            back: 'Voltar às promoções',
            validUntil: 'Válido até:',
            from: 'Desde',
            viewDetails: 'Ver Detalhes',
            exclusive: 'Experiência Exclusiva',
            contactPremium: 'Contacte-nos para descobrir todos os detalhes deste pacote premium.',
            programDetails: 'Detalhes do Programa',
            finalPrice: 'Preço Final',
            inclusions: 'O que inclui:',
            proposalResponse: 'Proposta em 24-48h',
            noPromotions: 'Sem promoções ativas',
            stayTuned: 'Fique atento, novas ofertas serão adicionadas em breve.'
        },
        cta: 'OFERTAS ESPECIAIS',
        footer: {
            rights: 'Todos os direitos reservados.',
        },
    },
    en: {
        nav: {
            home: 'Home',
            about: 'About',
            promotions: 'Promotions',
            contact: 'Contact',
        },
        promo: {
            interested: 'Interested in this offer?',
            contactText: 'Contact us to learn more details or customize your trip.',
            back: 'Back to promotions',
            validUntil: 'Valid until:',
            from: 'From',
            viewDetails: 'View Details',
            exclusive: 'Exclusive Experience',
            contactPremium: 'Contact us to discover all the details of this premium package.',
            programDetails: 'Program Details',
            finalPrice: 'Final Price',
            inclusions: 'Inclusions:',
            proposalResponse: 'Proposal in 24-48h',
            noPromotions: 'No active promotions',
            stayTuned: 'Stay tuned, new offers will be added soon.'
        },
        cta: 'SPECIAL OFFERS',
        footer: {
            rights: 'All rights reserved.',
        },
    },
    fr: {
        nav: {
            home: 'Accueil',
            about: 'À propos',
            promotions: 'Promotions',
            contact: 'Contact',
        },
        promo: {
            interested: 'Intéressé par cette offre?',
            contactText: 'Contactez-nous pour en savoir plus ou pour personnaliser votre voyage.',
            back: 'Retour aux promotions',
            validUntil: 'Valable jusqu\'au:',
            from: 'À partir de',
            viewDetails: 'Voir les détails',
            exclusive: 'Expérience Exclusive',
            contactPremium: 'Contactez-nous pour découvrir tous les détails de ce forfait premium.',
            programDetails: 'Détails du Programme',
            finalPrice: 'Prix Final',
            inclusions: 'Inclusions :',
            proposalResponse: 'Proposition en 24-48h',
            noPromotions: 'Pas de promotions actives',
            stayTuned: 'Restez connectés, de nouvelles offres seront ajoutées bientôt.'
        },
        cta: 'OFFRES SPÉCIALES',
        footer: {
            rights: 'Tous droits réservés.',
        },
    },
};

export const getDictionary = (lang: Locale) => dictionaries[lang] || dictionaries.pt;
